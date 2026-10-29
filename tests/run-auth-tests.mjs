#!/usr/bin/env node
/**
 * Sign-in and roles, tested against a real API and a throw-away database (see lib/test-stack.mjs).
 *
 *   node tests/run-auth-tests.mjs
 *
 * The API runs with Auth__Enforce=true on :5156. A second API on :5157 uses the same database with
 * enforcement OFF, to prove the default mode behaves as before. Passwords below are random, made up
 * for this run, and exist only inside the throw-away database.
 */
import { randomBytes } from 'node:crypto';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startStack, startApi, stopStack } from './lib/test-stack.mjs';

const ON = 'http://localhost:5156';
const OFF = 'http://localhost:5157';
const pw = () => `Tst-${randomBytes(9).toString('base64url')}-9z`;

let stack;
const accounts = {}; // name -> { username, password, token, id }
let managerToken;
let doctors = [];

const call = async (base, method, path, { token, body } = {}) => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not json */ }
  return { status: res.status, body: json, text };
};
const on = (method, path, opts) => call(ON, method, path, opts);

before(async () => {
  stack = await startStack({ port: 5156, env: { Auth__Enforce: 'true' } });
});
after(async () => {
  await stopStack();
});

const tokenOf = (name) => accounts[name].token;

/** a manager creates the account, the person signs in with the temporary password and must choose their own */
async function makeAccount(name, role, doctorId) {
  const temp = pw();
  const final = pw();
  const username = `${name}.${randomBytes(2).toString('hex')}`;
  const made = await on('POST', '/api/users', { token: managerToken, body: { username, displayName: `Test ${name}`, role, doctorId, password: temp } });
  assert.equal(made.status, 200, JSON.stringify(made.body));
  const first = await on('POST', '/api/auth/login', { body: { username, password: temp } });
  assert.equal(first.status, 200);
  assert.equal(first.body.mustChangePassword, true, 'a manager-given password must be replaced at first sign-in');
  const changed = await on('POST', '/api/auth/change-password', { token: first.body.token, body: { currentPassword: temp, newPassword: final } });
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
  accounts[name] = { username, password: final, token: changed.body.token, id: made.body.id };
}

// =============================================================================
// Before anyone has signed in
// =============================================================================

test('status: enforcement is on and nobody has been set up', async () => {
  const r = await on('GET', '/api/auth/status');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { enforced: true, hasUsers: false });
});

test('anonymous callers are refused everywhere except the public routes', async () => {
  for (const path of ['/api/doctors', '/api/patients', '/api/queue', '/api/prescriptions', '/api/schedules', '/api/medicines', '/api/users', '/api/pharmacy/prescriptions']) {
    const r = await on('GET', path);
    assert.equal(r.status, 401, `${path} should need sign-in, got ${r.status}`);
  }
  assert.equal((await on('POST', '/api/queue', { body: {} })).status, 401);
  assert.equal((await on('GET', '/api/status')).status, 200, 'the health check stays public');
});

test('setup refuses weak passwords and bad usernames', async () => {
  for (const bad of [
    { username: 'boss', displayName: 'Boss', password: 'short' },
    { username: 'boss', displayName: 'Boss', password: 'password123' },
    { username: 'boss', displayName: 'Boss', password: 'boss-boss-boss-1' }, // contains the username
    { username: 'B!', displayName: 'Boss', password: pw() },
    { username: 'boss', displayName: '  ', password: pw() },
  ]) {
    const r = await on('POST', '/api/auth/setup', { body: bad });
    assert.equal(r.status, 400, JSON.stringify(bad));
    assert.ok(r.body.errors.length > 0);
  }
  assert.equal((await on('GET', '/api/auth/status')).body.hasUsers, false, 'a refused setup creates nothing');
});

test('setup creates the first manager, once', async () => {
  const username = 'boss.' + randomBytes(2).toString('hex');
  const password = pw();
  const r = await on('POST', '/api/auth/setup', { body: { username, displayName: 'The Manager', password } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.user.role, 'manager');
  assert.equal(r.body.mustChangePassword, false, 'they chose this password themselves');
  managerToken = r.body.token;
  accounts.manager = { username, password, token: managerToken, id: r.body.user.id };

  const again = await on('POST', '/api/auth/setup', { body: { username: 'second.boss', displayName: 'Second', password: pw() } });
  assert.equal(again.status, 409, 'setup works only while there are no users');
  assert.equal((await on('GET', '/api/auth/status')).body.hasUsers, true);

  const me = await on('GET', '/api/auth/me', { token: managerToken });
  assert.equal(me.status, 200);
  assert.equal(me.body.user.username, username);
});

// =============================================================================
// Accounts
// =============================================================================

test('the manager creates one account per role, each forced to choose a private password', async () => {
  doctors = (await on('GET', '/api/doctors', { token: managerToken })).body;
  assert.ok(doctors.length >= 2, 'the seed has two doctors');
  const [d1, d2] = doctors;
  await makeAccount('doctor1', 'doctor', d1.id);
  await makeAccount('doctor2', 'doctor', d2.id);
  await makeAccount('assistant1', 'assistant', d1.id);
  await makeAccount('reception', 'receptionist');
  await makeAccount('pharmacist', 'pharmacist');
});

test('a temporary password unlocks nothing but the password change', async () => {
  const username = 'temp.' + randomBytes(2).toString('hex');
  const temp = pw();
  await on('POST', '/api/users', { token: managerToken, body: { username, displayName: 'Temp', role: 'receptionist', password: temp } });
  const login = await on('POST', '/api/auth/login', { body: { username, password: temp } });
  const blocked = await on('GET', '/api/patients', { token: login.body.token });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.code, 'password_change_required');
  assert.equal((await on('GET', '/api/auth/me', { token: login.body.token })).status, 200, 'they can still see who they are');
});

const bad = (name, body, status, match) =>
  test(`user creation rejected: ${name}`, async () => {
    const r = await on('POST', '/api/users', { token: managerToken, body: { username: 'x' + randomBytes(3).toString('hex'), displayName: 'X', role: 'receptionist', password: pw(), ...body } });
    assert.equal(r.status, status, JSON.stringify(r.body));
    assert.match(r.body.errors.join(' '), match);
  });
bad('unknown role', { role: 'janitor' }, 400, /role must be/);
bad('doctor without a linked doctor', { role: 'doctor' }, 400, /linked to a doctor/);
bad('assistant linked to a doctor that does not exist', { role: 'assistant', doctorId: 99999 }, 400, /does not exist/);
bad('weak password', { password: 'abc' }, 400, /at least 10/);
bad('bad username', { username: 'No Spaces!' }, 400, /username must be/);

test('user creation rejected: duplicate username (case does not matter)', async () => {
  const dup = await on('POST', '/api/users', { token: managerToken, body: { username: accounts.reception.username.toUpperCase(), displayName: 'Dup', role: 'receptionist', password: pw() } });
  assert.equal(dup.status, 409);
});

test('only the manager can create accounts or read the user list', async () => {
  for (const who of ['doctor1', 'assistant1', 'reception', 'pharmacist']) {
    assert.equal((await on('GET', '/api/users', { token: tokenOf(who) })).status, 403, who);
    assert.equal((await on('POST', '/api/users', { token: tokenOf(who), body: { username: 'zz' + who, displayName: 'Z', role: 'manager', password: pw() } })).status, 403, who);
  }
});

test('the user list never carries a password or hash', async () => {
  const r = await on('GET', '/api/users', { token: managerToken });
  assert.equal(r.status, 200);
  assert.ok(r.body.length >= 6);
  assert.ok(r.body.every((u) => !('password_hash' in u) && !('password' in u) && !('token_version' in u)), 'no secret fields on any row');
  assert.ok(!/pbkdf2/i.test(r.text), 'no hash text anywhere in the response');
});

// =============================================================================
// Signing in
// =============================================================================

test('login: an unknown user and a wrong password get the same answer', async () => {
  const wrongPassword = await on('POST', '/api/auth/login', { body: { username: accounts.reception.username, password: pw() } });
  const unknownUser = await on('POST', '/api/auth/login', { body: { username: 'nobody.' + randomBytes(2).toString('hex'), password: pw() } });
  assert.equal(wrongPassword.status, 401);
  assert.equal(unknownUser.status, 401);
  assert.deepEqual(wrongPassword.body, unknownUser.body, 'the reply must not reveal which usernames exist');
});

test('login: five wrong passwords lock the account, even for the right password', async () => {
  const name = 'locky.' + randomBytes(2).toString('hex');
  const password = pw();
  await on('POST', '/api/users', { token: managerToken, body: { username: name, displayName: 'Locky', role: 'receptionist', password } });
  for (let i = 0; i < 5; i++) assert.equal((await on('POST', '/api/auth/login', { body: { username: name, password: pw() } })).status, 401);
  const locked = await on('POST', '/api/auth/login', { body: { username: name, password } });
  assert.equal(locked.status, 423);
  assert.match(locked.body.errors[0], /Try again in \d+ minute/);
  const list = (await on('GET', '/api/users', { token: managerToken })).body;
  assert.equal(list.find((u) => u.username === name).is_locked, true, 'the manager can see who is locked');
});

test('tokens: garbage and tampered tokens are refused', async () => {
  assert.equal((await on('GET', '/api/doctors', { token: 'not-a-token' })).status, 401);
  const parts = tokenOf('doctor1').split('.');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  payload.role = 'manager';
  const forged = [parts[0], Buffer.from(JSON.stringify(payload)).toString('base64url'), parts[2]].join('.');
  assert.equal((await on('GET', '/api/users', { token: forged })).status, 401, 'changing the role inside a token breaks its signature');
});

// =============================================================================
// Who may do what
// =============================================================================

const allowed = (r) => r.status !== 401 && r.status !== 403;
const matrix = [
  ['reception', 'GET', '/api/patients', true], ['reception', 'GET', '/api/schedules', true], ['reception', 'GET', '/api/queue', true],
  ['reception', 'GET', '/api/prescriptions', false], ['reception', 'PUT', '/api/doctors/1/schedule', false],
  ['reception', 'GET', '/api/pharmacy/prescriptions', false], ['reception', 'POST', '/api/ai/analyze-consultation', false],
  ['pharmacist', 'GET', '/api/pharmacy/prescriptions', true], ['pharmacist', 'GET', '/api/medicines', true], ['pharmacist', 'GET', '/api/doctors', true],
  ['pharmacist', 'GET', '/api/patients', false], ['pharmacist', 'GET', '/api/queue', false], ['pharmacist', 'GET', '/api/prescriptions', false],
  ['assistant1', 'GET', '/api/prescriptions', true], ['assistant1', 'POST', '/api/prescriptions', false], ['assistant1', 'PUT', '/api/doctors/1/schedule', false],
  ['assistant1', 'GET', '/api/users', false],
  ['doctor1', 'POST', '/api/prescriptions', true, 'own'], ['doctor1', 'PUT', '/api/doctors/1/schedule', false], ['doctor1', 'POST', '/api/branches', false],
  ['doctor1', 'GET', '/api/users', false], ['doctor1', 'GET', '/api/pharmacy/prescriptions', false],
  ['manager', 'GET', '/api/users', true], ['manager', 'GET', '/api/schedules', true], ['manager', 'GET', '/api/pharmacy/prescriptions', true],
  ['manager', 'POST', '/api/prescriptions', false],
];
for (const [who, method, path, ok, own] of matrix) {
  test(`role: ${who} ${method} ${path} is ${ok ? 'allowed' : 'refused'}`, async () => {
    // writes that name a chamber must name the caller's own, or the doctor-isolation rule (correctly) refuses them
    const body = method === 'GET' ? undefined : own ? { doctorId: doctors[0].id } : {};
    const r = await on(method, path, { token: tokenOf(who), body });
    assert.equal(allowed(r), ok, `got ${r.status} ${r.text.slice(0, 120)}`);
    if (!ok) assert.equal(r.status, 403);
  });
}

test('role: the manager can change a schedule', async () => {
  const r = await on('PUT', `/api/doctors/${doctors[0].id}/schedule`, { token: managerToken, body: { acceptsOnlineBooking: false, sessions: [] } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
});

// =============================================================================
// Doctor isolation: the chamber belongs to one doctor
// =============================================================================

test('isolation: a doctor sees only their own queue, and cannot ask for another', async () => {
  const [d1, d2] = doctors;
  const patients = (await on('GET', '/api/patients', { token: tokenOf('reception') })).body;
  const made = await on('POST', '/api/queue', { token: tokenOf('reception'), body: { doctorId: d2.id, patientId: patients[0].id, triageVitals: {}, chiefComplaint: 'isolation test' } });
  assert.equal(made.status, 200, 'reception may queue a patient for any doctor');
  const otherQueueId = made.body.id;

  const mine = (await on('GET', '/api/queue', { token: tokenOf('doctor1') })).body;
  assert.ok(mine.length > 0 && mine.every((q) => q.doctor_id === d1.id), 'doctor 1 sees only doctor 1 rows, even without asking for a filter');
  const theirs = (await on('GET', '/api/queue', { token: tokenOf('doctor2') })).body;
  assert.ok(theirs.some((q) => q.id === otherQueueId) && theirs.every((q) => q.doctor_id === d2.id));

  assert.equal((await on('GET', `/api/queue?doctorId=${d2.id}`, { token: tokenOf('doctor1') })).status, 403);
  assert.equal((await on('GET', `/api/queue?doctorId=${d2.id}`, { token: tokenOf('assistant1') })).status, 403, 'an assistant is held to their own doctor too');
  assert.equal((await on('PATCH', `/api/queue/${otherQueueId}/status`, { token: tokenOf('doctor1'), body: { status: 'Completed' } })).status, 403);
  assert.equal((await on('POST', '/api/queue', { token: tokenOf('doctor1'), body: { doctorId: d2.id, patientId: patients[0].id, triageVitals: {} } })).status, 403);
  assert.equal((await on('PATCH', `/api/queue/${otherQueueId}/status`, { token: tokenOf('doctor2'), body: { status: 'In Consultation' } })).status, 200, 'the owner can');
});

test('isolation: prescriptions, templates and profiles are the doctor\'s own', async () => {
  const [d1, d2] = doctors;
  const asManager = (await on('GET', '/api/prescriptions', { token: managerToken })).body;
  const d1Rx = asManager.find((p) => p.doctor_id === d1.id);
  assert.ok(d1Rx, 'the seed has a prescription for doctor 1');

  assert.equal((await on('GET', `/api/prescriptions/${d1Rx.id}`, { token: tokenOf('doctor1') })).status, 200);
  assert.equal((await on('GET', `/api/prescriptions/${d1Rx.id}`, { token: tokenOf('doctor2') })).status, 403);
  const list2 = (await on('GET', '/api/prescriptions', { token: tokenOf('doctor2') })).body;
  assert.ok(list2.every((p) => p.doctor_id === d2.id), 'doctor 2 never sees doctor 1 prescriptions in a list');
  assert.equal((await on('PUT', `/api/prescriptions/${d1Rx.id}`, { token: tokenOf('doctor2'), body: { doctorId: d2.id } })).status, 403);
  assert.equal((await on('POST', '/api/prescriptions', { token: tokenOf('doctor2'), body: { doctorId: d1.id } })).status, 403, 'cannot sign into another doctor\'s name');

  assert.equal((await on('GET', `/api/templates?doctorId=${d1.id}`, { token: tokenOf('doctor2') })).status, 403);
  assert.equal((await on('GET', `/api/templates?doctorId=${d2.id}`, { token: tokenOf('doctor2') })).status, 200);

  assert.equal((await on('PUT', `/api/doctors/${d2.id}`, { token: tokenOf('doctor1'), body: { ...d2, id: d2.id } })).status, 403, 'a doctor edits only their own profile');
});

// =============================================================================
// Pharmacy sees the minimum
// =============================================================================

test('pharmacy: only signed prescriptions, and never a diagnosis or note', async () => {
  const list = await on('GET', '/api/pharmacy/prescriptions', { token: tokenOf('pharmacist') });
  assert.equal(list.status, 200);
  assert.ok(list.body.every((r) => r.is_signed === true));
  assert.ok(!/diagnos|complaint|vitals|advice|exam_notes|red_flag/i.test(list.text), 'the list holds no clinical notes');
  assert.ok(list.body.length > 0, 'the seed has a signed prescription');

  const detail = await on('GET', `/api/pharmacy/prescriptions/${list.body[0].id}`, { token: tokenOf('pharmacist') });
  assert.equal(detail.status, 200);
  assert.ok(Array.isArray(detail.body.items));
  assert.ok(!/diagnos|chief_complaints|"vitals"|advice_bangla|exam_notes|red_flags|general_signs/i.test(detail.text), 'the detail holds no clinical notes');
  assert.equal((await on('GET', '/api/pharmacy/prescriptions/987654', { token: tokenOf('pharmacist') })).status, 404);
});

// =============================================================================
// Ending and changing access
// =============================================================================

test('logout ends the session on the server, not just in the browser', async () => {
  const login = await on('POST', '/api/auth/login', { body: { username: accounts.pharmacist.username, password: accounts.pharmacist.password } });
  assert.equal(login.status, 200);
  assert.equal((await on('GET', '/api/medicines', { token: login.body.token })).status, 200);
  assert.equal((await on('POST', '/api/auth/logout', { token: login.body.token })).status, 204);
  assert.equal((await on('GET', '/api/medicines', { token: login.body.token })).status, 401, 'the same token is dead after logout');
});

test('changing a password: needs the current one, kills old tokens, and the old password stops working', async () => {
  const a = accounts.reception;
  const wrong = await on('POST', '/api/auth/change-password', { token: a.token, body: { currentPassword: pw(), newPassword: pw() } });
  assert.equal(wrong.status, 400);
  const same = await on('POST', '/api/auth/change-password', { token: a.token, body: { currentPassword: a.password, newPassword: a.password } });
  assert.equal(same.status, 400);

  const next = pw();
  const ok = await on('POST', '/api/auth/change-password', { token: a.token, body: { currentPassword: a.password, newPassword: next } });
  assert.equal(ok.status, 200);
  assert.equal((await on('GET', '/api/patients', { token: a.token })).status, 401, 'the old token is revoked');
  assert.equal((await on('POST', '/api/auth/login', { body: { username: a.username, password: a.password } })).status, 401);
  const fresh = await on('POST', '/api/auth/login', { body: { username: a.username, password: next } });
  assert.equal(fresh.status, 200);
  a.password = next;
  a.token = fresh.body.token;
});

test('a manager reset forces a new password and revokes the old session', async () => {
  const a = accounts.assistant1;
  const temp = pw();
  assert.equal((await on('POST', `/api/users/${a.id}/reset-password`, { token: managerToken, body: { password: temp } })).status, 204);
  assert.equal((await on('GET', '/api/queue', { token: a.token })).status, 401);
  const login = await on('POST', '/api/auth/login', { body: { username: a.username, password: temp } });
  assert.equal(login.body.mustChangePassword, true);
  const weak = await on('POST', `/api/users/${a.id}/reset-password`, { token: managerToken, body: { password: 'short' } });
  assert.equal(weak.status, 400);
  const final = pw();
  const changed = await on('POST', '/api/auth/change-password', { token: login.body.token, body: { currentPassword: temp, newPassword: final } });
  a.password = final;
  a.token = changed.body.token;
  assert.equal((await on('GET', '/api/queue', { token: a.token })).status, 200);
});

test('switching an account off ends its session at once and blocks sign-in', async () => {
  const a = accounts.reception;
  assert.equal((await on('PUT', `/api/users/${a.id}`, { token: managerToken, body: { isActive: false } })).status, 200);
  assert.equal((await on('GET', '/api/patients', { token: a.token })).status, 401);
  const login = await on('POST', '/api/auth/login', { body: { username: a.username, password: a.password } });
  assert.equal(login.status, 401);
  assert.equal((await on('PUT', `/api/users/${a.id}`, { token: managerToken, body: { isActive: true } })).status, 200);
  const back = await on('POST', '/api/auth/login', { body: { username: a.username, password: a.password } });
  assert.equal(back.status, 200, 'switching back on restores access with the same password');
  a.token = back.body.token;
});

test('changing a role takes effect on the next request', async () => {
  const a = accounts.reception;
  assert.equal((await on('GET', '/api/patients', { token: a.token })).status, 200);
  assert.equal((await on('PUT', `/api/users/${a.id}`, { token: managerToken, body: { role: 'pharmacist' } })).status, 200);
  assert.equal((await on('GET', '/api/patients', { token: a.token })).status, 401, 'the old token no longer carries the old role');
  const login = await on('POST', '/api/auth/login', { body: { username: a.username, password: a.password } });
  assert.equal((await on('GET', '/api/patients', { token: login.body.token })).status, 403, 'now a pharmacist: no patient list');
  assert.equal((await on('GET', '/api/pharmacy/prescriptions', { token: login.body.token })).status, 200);
});

test('a manager cannot lock themselves out', async () => {
  const self = accounts.manager.id;
  const off = await on('PUT', `/api/users/${self}`, { token: managerToken, body: { isActive: false } });
  assert.equal(off.status, 400);
  const demote = await on('PUT', `/api/users/${self}`, { token: managerToken, body: { role: 'receptionist' } });
  assert.equal(demote.status, 400);
  assert.equal((await on('GET', '/api/users', { token: managerToken })).status, 200, 'still a manager');
});

// =============================================================================
// The audit trail
// =============================================================================

test('every sign-in event is recorded, and no password ever is', async () => {
  const events = await on('GET', '/api/auth/events', { token: managerToken });
  assert.equal(events.status, 200);
  const names = new Set(events.body.map((e) => e.event));
  for (const expected of ['setup', 'login', 'login_failed', 'locked', 'login_blocked', 'user_created', 'logout', 'password_changed', 'password_reset', 'user_changed']) {
    assert.ok(names.has(expected), `missing audit event: ${expected}`);
  }
  for (const a of Object.values(accounts)) assert.ok(!events.text.includes(a.password), 'a password appears in the audit log');
  assert.equal((await on('GET', '/api/auth/events', { token: tokenOf('doctor1') })).status, 403);
});

// =============================================================================
// Enforcement switched off = the app behaves as it did before
// =============================================================================

test('enforcement off: the API is open as before, but account management never is', async () => {
  const off = await startApi({ dbName: stack.dbName, port: 5157, env: { Auth__Enforce: 'false' } });
  assert.equal(off.base, OFF);

  const status = await call(OFF, 'GET', '/api/auth/status');
  assert.equal(status.body.enforced, false);
  for (const path of ['/api/doctors', '/api/patients', '/api/queue', '/api/prescriptions', '/api/schedules']) {
    assert.equal((await call(OFF, 'GET', path)).status, 200, `${path} stays open when enforcement is off`);
  }
  assert.equal((await call(OFF, 'GET', '/api/users')).status, 401, 'the user list needs a manager even when enforcement is off');
  assert.equal((await call(OFF, 'POST', '/api/users', { body: { username: 'sneaky', displayName: 'S', role: 'manager', password: pw() } })).status, 401);
  assert.equal((await call(OFF, 'POST', '/api/auth/setup', { body: { username: 'sneaky', displayName: 'S', password: pw() } })).status, 409, 'setup stays closed once a manager exists');
  // a signed-in manager still works against the off-mode API (same signing key, same database)
  assert.equal((await call(OFF, 'GET', '/api/users', { token: managerToken })).status, 200);
});
