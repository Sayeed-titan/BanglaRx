/**
 * A throw-away copy of the whole back end: its own PostgreSQL database (loaded from
 * database/init_database.sql) and its own API process on another port. Your working database
 * and the API you run with start_banglarx.bat are never touched.
 *
 *   startStack() -> { base, dbName }   writes %TEMP%/rx-test-stack.json
 *   stopStack()                        stops the API and DROPS the database (reads that file)
 */
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const API_DIR = join(ROOT, 'BanglaRx.Api');
const BUILD_DIR = join(tmpdir(), 'rx-api-test-build');
const STATE = join(tmpdir(), 'rx-test-stack.json');

// connection settings come from the app's own config; the password is never printed
function connection() {
  // the connection string lives in the git-ignored appsettings.local.json, or in ConnectionStrings__DefaultConnection
  let conn = process.env.ConnectionStrings__DefaultConnection;
  if (!conn) {
    const local = join(API_DIR, 'appsettings.local.json');
    if (!existsSync(local)) throw new Error('No database settings: put ConnectionStrings:DefaultConnection in BanglaRx.Api/appsettings.local.json or set ConnectionStrings__DefaultConnection.');
    conn = JSON.parse(readFileSync(local, 'utf8')).ConnectionStrings?.DefaultConnection;
    if (!conn) throw new Error('appsettings.local.json has no ConnectionStrings:DefaultConnection.');
  }
  return Object.fromEntries(
    conn.split(';').filter(Boolean).map((p) => {
      const i = p.indexOf('=');
      return [p.slice(0, i).trim().toLowerCase(), p.slice(i + 1).trim()];
    }),
  );
}

function findPsql() {
  if (spawnSync('psql', ['--version']).status === 0) return 'psql';
  const base = 'C:\\Program Files\\PostgreSQL';
  if (existsSync(base)) {
    for (const v of readdirSync(base).sort().reverse()) {
      const p = join(base, v, 'bin', 'psql.exe');
      if (existsSync(p)) return p;
    }
  }
  throw new Error('psql not found');
}

function psqlRunner() {
  const c = connection();
  const bin = findPsql();
  const env = { ...process.env, PGPASSWORD: c.password };
  return {
    c,
    run: (db, args) => spawnSync(bin, ['-h', c.host, '-p', c.port ?? '5432', '-U', c.username, '-d', db, '-v', 'ON_ERROR_STOP=1', '-q', ...args], { env, encoding: 'utf8' }),
  };
}

function launchApi({ c, dbName, base, extraEnv }) {
  let log = '';
  const api = spawn('dotnet', [join(BUILD_DIR, 'BanglaRx.Api.dll')], {
    cwd: API_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ASPNETCORE_URLS: base,
      ConnectionStrings__DefaultConnection: `Host=${c.host};Port=${c.port ?? '5432'};Database=${dbName};Username=${c.username};Password=${c.password};`,
      // the API now enforces sign-in by default; the plain suites run without it unless a test asks for it
      Auth__Enforce: 'false',
      ...extraEnv,
    },
  });
  api.stdout.on('data', (d) => (log += d));
  api.stderr.on('data', (d) => (log += d));
  return { api, getLog: () => log };
}

/** A second API process on the same throw-away database (for example with enforcement switched the other way). */
export async function startApi({ dbName, port, env: extraEnv = {} }) {
  const c = connection();
  const base = `http://localhost:${port}`;
  const { api, getLog } = launchApi({ c, dbName, base, extraEnv });
  const state = JSON.parse(readFileSync(STATE, 'utf8'));
  writeFileSync(STATE, JSON.stringify({ ...state, extraPids: [...(state.extraPids ?? []), api.pid] }));
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(`${base}/api/status`);
      if (res.ok) {
        const seen = (await res.json()).databaseName;
        if (seen !== dbName) { api.kill(); throw new Error(`SAFETY STOP: the second test API is connected to "${seen}", not "${dbName}".`); }
        return { base, api, getLog };
      }
    } catch (e) { if (String(e.message).startsWith('SAFETY STOP')) throw e; /* not up yet */ }
    await new Promise((res) => setTimeout(res, 500));
  }
  throw new Error(`second API did not start:
${getLog().slice(-1500)}`);
}

export async function startStack({ port = 5155, env: extraEnv = {} } = {}) {
  if (existsSync(STATE)) await stopStack();
  const { c, run } = psqlRunner();
  const dbName = `banglarx_test_${Date.now()}`;
  const base = `http://localhost:${port}`;

  let r = run('postgres', ['-c', `CREATE DATABASE ${dbName}`]);
  if (r.status !== 0) throw new Error(`could not create the test database: ${r.stderr}`);
  writeFileSync(STATE, JSON.stringify({ dbName, apiPid: null }));

  r = run(dbName, ['-f', join(ROOT, 'database', 'init_database.sql')]);
  if (r.status !== 0) throw new Error(`could not load init_database.sql: ${r.stderr}`);

  const b = spawnSync('dotnet', ['build', '-nologo', '-v', 'q', '-o', BUILD_DIR], { cwd: API_DIR, encoding: 'utf8' });
  if (b.status !== 0) throw new Error(`dotnet build failed:\n${b.stdout}\n${b.stderr}`);

  const started = launchApi({ c, dbName, base, extraEnv });
  const { api, getLog } = started;
  writeFileSync(STATE, JSON.stringify({ dbName, apiPid: api.pid, extraPids: [] }));

  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(`${base}/api/status`);
      if (res.ok) {
        // never let a suite write to a database other than its own throw-away one (a settings file once overrode it)
        const seen = (await res.json()).databaseName;
        if (seen !== dbName) {
          await stopStack();
          throw new Error(`SAFETY STOP: the test API is connected to "${seen}", not the throw-away database "${dbName}". Nothing was run.`);
        }
        return { base, dbName, api, getLog, c };
      }
    } catch { /* not up yet */ }
    await new Promise((res) => setTimeout(res, 500));
  }
  await stopStack();
  throw new Error(`API did not start:\n${log.slice(-1500)}`);
}

export async function stopStack() {
  if (!existsSync(STATE)) return;
  const { dbName, apiPid, extraPids = [] } = JSON.parse(readFileSync(STATE, 'utf8'));
  for (const pid of [apiPid, ...extraPids]) if (pid) spawnSync('taskkill', ['/PID', String(pid), '/T', '/F']);
  await new Promise((res) => setTimeout(res, 800));
  const { run } = psqlRunner();
  run('postgres', ['-c', `DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`]);
  rmSync(STATE, { force: true });
  console.log(`(test database ${dbName} dropped, test API stopped)`);
}
