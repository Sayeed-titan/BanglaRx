#!/usr/bin/env node
/**
 * Full-stack API tests: real PostgreSQL, real API process, real HTTP.
 *
 *   node tests/run-api-tests.mjs
 *
 * Safety: it never touches your working database. It creates a throw-away database
 * (banglarx_test_<time>) on the same Postgres server, loads database/init_database.sql,
 * starts the API from a separate build folder on port 5155, runs the tests, then stops the
 * API and DROPS the throw-away database, even when tests fail.
 *
 * Needs: psql on PATH (or in C:\Program Files\PostgreSQL\*\bin), dotnet 8 SDK.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startStack, stopStack } from './lib/test-stack.mjs';

const PORT = 5155;
const BASE = `http://localhost:${PORT}`;
let apiLog = () => '';

before(async () => {
  const stack = await startStack({ port: PORT });
  apiLog = stack.getLog;
});

after(async () => {
  await stopStack();
});

const get = async (path) => {
  const res = await fetch(`${BASE}${path}`);
  const text = await res.text();
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}: ${text.slice(0, 300)}
API log tail:
${apiLog().slice(-1200)}`);
  return JSON.parse(text);
};
const send = async (method, path, body) => {
  const res = await fetch(`${BASE}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json().catch(() => null) };
};

// =============================================================================
// Branches, specialties, schedules
// =============================================================================

test('schema: branches and specialties are derived from the existing doctors, not invented', async () => {
  const doctors = await get('/api/doctors');
  const branches = await get('/api/branches');
  const specialties = await get('/api/specialties');
  assert.ok(doctors.length > 0, 'seed has doctors');
  const hospitals = new Set(doctors.map((d) => d.hospital_name.trim()));
  assert.deepEqual(new Set(branches.map((b) => b.name)), hospitals);
  const specs = new Set(doctors.map((d) => d.specialization.trim()));
  assert.deepEqual(new Set(specialties.map((s) => s.name)), specs);
});

test('schedules: every doctor is listed and starts with no sessions', async () => {
  const doctors = await get('/api/doctors');
  const all = await get('/api/schedules');
  assert.equal(all.length, doctors.length);
  for (const d of all) {
    assert.deepEqual(d.sessions, [], 'no schedule rows are created by the system');
    assert.equal(d.doctor.acceptsOnlineBooking, false, 'online booking is off until someone turns it on');
  }
});

test('schedule: saving a week round-trips exactly', async () => {
  const [doc] = await get('/api/doctors');
  const [branch] = await get('/api/branches');
  const body = {
    consultationFee: 800,
    acceptsOnlineBooking: true,
    onLeaveUntil: null,
    sessions: [
      { branchId: branch.id, weekday: 6, startTime: '16:00', endTime: '20:00', slotMinutes: 12 },
      { branchId: branch.id, weekday: 0, startTime: '09:00', endTime: '13:00', slotMinutes: 10 },
      { branchId: branch.id, weekday: 0, startTime: '16:00', endTime: '18:00', slotMinutes: 10 },
    ],
  };
  const res = await send('PUT', `/api/doctors/${doc.id}/schedule`, body);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.doctor.consultationFee, 800);
  assert.equal(res.body.doctor.acceptsOnlineBooking, true);
  assert.equal(res.body.sessions.length, 3);

  const saved = (await get('/api/schedules')).find((d) => d.doctor.id === doc.id);
  const sunday = saved.sessions.filter((s) => s.weekday === 0).map((s) => `${s.startTime}-${s.endTime}`);
  assert.deepEqual(sunday, ['09:00-13:00', '16:00-18:00'], 'ordered by time, two sessions on one day allowed');
  const sat = saved.sessions.find((s) => s.weekday === 6);
  assert.equal(sat.slotMinutes, 12);
  assert.equal(sat.branchName, branch.name);
});

test('schedule: saving again replaces the old week, it does not pile up', async () => {
  const [doc] = await get('/api/doctors');
  const [branch] = await get('/api/branches');
  const res = await send('PUT', `/api/doctors/${doc.id}/schedule`, {
    consultationFee: null,
    acceptsOnlineBooking: false,
    sessions: [{ branchId: branch.id, weekday: 2, startTime: '10:00', endTime: '12:00', slotMinutes: 15 }],
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.sessions.length, 1);
  assert.equal(res.body.sessions[0].weekday, 2);
  assert.equal(res.body.doctor.consultationFee, undefined, 'a cleared fee is really cleared (null is not sent)');
});

test('schedule: sending no sessions clears the week', async () => {
  const [doc] = await get('/api/doctors');
  const res = await send('PUT', `/api/doctors/${doc.id}/schedule`, { acceptsOnlineBooking: false, sessions: [] });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.sessions, []);
});

test('schedule: on-leave date is stored and returned', async () => {
  const [doc] = await get('/api/doctors');
  const res = await send('PUT', `/api/doctors/${doc.id}/schedule`, { acceptsOnlineBooking: false, onLeaveUntil: '2026-11-03', sessions: [] });
  assert.equal(res.status, 200);
  assert.equal(res.body.doctor.onLeaveUntil, '2026-11-03');
});

const rejects = (name, mutate, expected) =>
  test(`schedule rejected: ${name}`, async () => {
    const [doc] = await get('/api/doctors');
    const [branch] = await get('/api/branches');
    const base = { branchId: branch.id, weekday: 1, startTime: '09:00', endTime: '12:00', slotMinutes: 10 };
    const body = mutate({ acceptsOnlineBooking: false, sessions: [base] }, base, branch);
    const before = (await get('/api/schedules')).find((d) => d.doctor.id === doc.id);
    const res = await send('PUT', `/api/doctors/${doc.id}/schedule`, body);
    assert.equal(res.status, 400, `expected 400, got ${res.status}`);
    assert.match(res.body.errors.join(' | '), expected);
    const after = (await get('/api/schedules')).find((d) => d.doctor.id === doc.id);
    assert.deepEqual(after, before, 'a rejected save changes nothing');
  });

rejects('end before start', (b, s) => ((s.endTime = '08:00'), b), /end time must be after/);
rejects('end equal to start', (b, s) => ((s.endTime = '09:00'), b), /end time must be after/);
rejects('weekday out of range', (b, s) => ((s.weekday = 7), b), /weekday must be/);
rejects('unknown branch', (b, s) => ((s.branchId = 99999), b), /branch does not exist/);
rejects('bad time text', (b, s) => ((s.startTime = '9am'), b), /times must look like/);
rejects('slot too small', (b, s) => ((s.slotMinutes = 2), b), /minutes per patient/);
rejects('slot longer than the session', (b, s) => ((s.endTime = '09:20'), (s.slotMinutes = 30), b), /shorter than one appointment/);
rejects('negative fee', (b) => ((b.consultationFee = -5), b), /visit fee/);
rejects('bad leave date', (b) => ((b.onLeaveUntil = 'tomorrow'), b), /date like/);
rejects('overlapping sessions the same day', (b, s, br) => (b.sessions.push({ ...s, startTime: '11:00', endTime: '14:00', branchId: br.id }), b), /overlap/);

test('schedule: a doctor that does not exist is a 404', async () => {
  const res = await send('PUT', '/api/doctors/987654/schedule', { sessions: [] });
  assert.equal(res.status, 404);
});

test('branches: create, duplicate is a 409, blank is a 400', async () => {
  const created = await send('POST', '/api/branches', { name: 'North Branch', address: 'Uttara' });
  assert.equal(created.status, 200);
  const dup = await send('POST', '/api/branches', { name: 'North Branch' });
  assert.equal(dup.status, 409);
  const blank = await send('POST', '/api/branches', { name: '   ' });
  assert.equal(blank.status, 400);
  assert.ok((await get('/api/branches')).some((b) => b.name === 'North Branch'));
});

test('branches: a switched-off branch cannot be scheduled', async () => {
  const [doc] = await get('/api/doctors');
  const made = await send('POST', '/api/branches', { name: 'Closed Branch' });
  await send('PUT', `/api/branches/${made.body.id}`, { name: 'Closed Branch', isActive: false });
  const res = await send('PUT', `/api/doctors/${doc.id}/schedule`, {
    sessions: [{ branchId: made.body.id, weekday: 3, startTime: '10:00', endTime: '12:00', slotMinutes: 10 }],
  });
  assert.equal(res.status, 400);
});

test('existing features still work after the schema change (doctors, queue, prescriptions)', async () => {
  assert.ok((await get('/api/doctors')).length > 0);
  assert.ok(Array.isArray(await get('/api/queue')));
  assert.ok(Array.isArray(await get('/api/prescriptions')));
  const status = await get('/api/status');
  assert.equal(status.databaseConnected, true);
});
