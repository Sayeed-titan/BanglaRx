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
  const cfg = JSON.parse(readFileSync(join(API_DIR, 'appsettings.json'), 'utf8'));
  return Object.fromEntries(
    cfg.ConnectionStrings.DefaultConnection.split(';').filter(Boolean).map((p) => {
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

export async function startStack({ port = 5155 } = {}) {
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

  let log = '';
  const api = spawn('dotnet', [join(BUILD_DIR, 'BanglaRx.Api.dll')], {
    cwd: API_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ASPNETCORE_URLS: base,
      ConnectionStrings__DefaultConnection: `Host=${c.host};Port=${c.port ?? '5432'};Database=${dbName};Username=${c.username};Password=${c.password};`,
    },
  });
  api.stdout.on('data', (d) => (log += d));
  api.stderr.on('data', (d) => (log += d));
  writeFileSync(STATE, JSON.stringify({ dbName, apiPid: api.pid }));

  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(`${base}/api/status`)).ok) return { base, dbName, api, getLog: () => log };
    } catch { /* not up yet */ }
    await new Promise((res) => setTimeout(res, 500));
  }
  await stopStack();
  throw new Error(`API did not start:\n${log.slice(-1500)}`);
}

export async function stopStack() {
  if (!existsSync(STATE)) return;
  const { dbName, apiPid } = JSON.parse(readFileSync(STATE, 'utf8'));
  if (apiPid) spawnSync('taskkill', ['/PID', String(apiPid), '/T', '/F']);
  await new Promise((res) => setTimeout(res, 800));
  const { run } = psqlRunner();
  run('postgres', ['-c', `DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`]);
  rmSync(STATE, { force: true });
  console.log(`(test database ${dbName} dropped, test API stopped)`);
}
