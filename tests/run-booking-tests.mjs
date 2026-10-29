#!/usr/bin/env node
/**
 * Booking, tested against a real API and a throw-away database (see lib/test-stack.mjs).
 *
 *   node tests/run-booking-tests.mjs
 *
 * "Now" is frozen at Monday 2026-11-02 10:00 clinic time (Booking__FakeNow) so every date rule can be
 * checked exactly. Sign-in is enforced, so role limits are tested too. Passwords are random and exist
 * only inside the throw-away database.
 */
import { randomBytes } from 'node:crypto';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startStack, startApi, stopStack } from './lib/test-stack.mjs';

const BASE = 'http://localhost:5158';
const LATER = 'http://localhost:5159'; // same database, clock moved on to Monday 2026-11-09 11:00
const pw = () => `Tst-${randomBytes(9).toString('base64url')}-9z`;

const TODAY = '2026-11-02'; // Monday
const NEXT_MON = '2026-11-09';
const TUE = '2026-11-03';

let stack, branch, d1, d2, seedPatients;
const who = {};
let managerToken;

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
const api = (method, path, opts) => call(BASE, method, path, opts);
const as = (name) => ({ token: who[name].token });

async function account(name, role, doctorId) {
  const temp = pw(), final = pw(), username = `${name}.${randomBytes(2).toString('hex')}`;
  const made = await api('POST', '/api/users', { token: managerToken, body: { username, displayName: name, role, doctorId, password: temp } });
  assert.equal(made.status, 200, JSON.stringify(made.body));
  const first = await api('POST', '/api/auth/login', { body: { username, password: temp } });
  const changed = await api('POST', '/api/auth/change-password', { token: first.body.token, body: { currentPassword: temp, newPassword: final } });
  who[name] = { token: changed.body.token, id: made.body.id };
}

let n = 0;
const fresh = () => ({ fullName: `Booking Test ${++n}`, age: 30 + (n % 20), gender: 'Female', phone: `0171100${String(1000 + n)}` });
const book = (doctorId, date, time, extra = {}) =>
  api('POST', '/api/bookings', { ...as('reception'), body: { doctorId, date, time, newPatient: fresh(), reason: 'test visit', source: 'front_desk', ...extra } });
const slots = async (doctorId, date, onlyOpen) => (await api('GET', `/api/slots?doctorId=${doctorId}&date=${date}${onlyOpen ? '&onlyOpen=true' : ''}`, as('reception'))).body;
const state = async (doctorId, date, time) => (await slots(doctorId, date)).slots.find((s) => s.time === time)?.state;

before(async () => {
  stack = await startStack({ port: 5158, env: { Auth__Enforce: 'true', Booking__FakeNow: `${TODAY}T10:00:00` } });
  const setup = await api('POST', '/api/auth/setup', { body: { username: 'boss.bk', displayName: 'Boss', password: pw() } });
  managerToken = setup.body.token;
  who.manager = { token: managerToken };
  [d1, d2] = (await api('GET', '/api/doctors', { token: managerToken })).body;
  [branch] = (await api('GET', '/api/branches', { token: managerToken })).body;
  await account('reception', 'receptionist');
  await account('doctor1', 'doctor', d1.id);
  await account('doctor2', 'doctor', d2.id);
  await account('assistant1', 'assistant', d1.id);
  await account('pharmacist', 'pharmacist');
  seedPatients = (await api('GET', '/api/patients', as('reception'))).body;

  // doctor 1: Mondays 10:00-12:00 in 20 minute slots, Tuesdays 09:00-10:00 in 30 minute slots. Doctor 2 has no schedule.
  const sched = await api('PUT', `/api/doctors/${d1.id}/schedule`, {
    token: managerToken,
    body: {
      acceptsOnlineBooking: false,
      sessions: [
        { branchId: branch.id, weekday: 1, startTime: '10:00', endTime: '12:00', slotMinutes: 20 },
        { branchId: branch.id, weekday: 2, startTime: '09:00', endTime: '10:00', slotMinutes: 30 },
      ],
    },
  });
  assert.equal(sched.status, 200, JSON.stringify(sched.body));
});
after(async () => {
  await stopStack();
});

// =============================================================================
// Which times exist
// =============================================================================

test("info: the clinic clock is the server's, not the browser's", async () => {
  const r = await api('GET', '/api/booking/info', as('reception'));
  assert.deepEqual(r.body, { today: TODAY, now: '10:00', maxDaysAhead: 30, minLeadMinutes: 15 });
  assert.equal((await api('GET', '/api/booking/info', as('pharmacist'))).status, 403);
});

test('slots: a Monday has exactly the six 20-minute times of the session', async () => {
  const day = await slots(d1.id, NEXT_MON);
  assert.deepEqual(day.slots.map((s) => s.time), ['10:00', '10:20', '10:40', '11:00', '11:20', '11:40']);
  assert.ok(day.slots.every((s) => s.state === 'open' && s.minutes === 20 && s.branchName === branch.name));
  assert.equal((await slots(d1.id, TUE)).slots.length, 2, 'Tuesday has 09:00 and 09:30');
});

test('slots: a day without a session, and a doctor without any schedule, offer nothing and say why', async () => {
  const wed = await slots(d1.id, '2026-11-04');
  assert.deepEqual(wed.slots, []);
  assert.match(wed.note, /no session/i);
  assert.deepEqual((await slots(d2.id, NEXT_MON)).slots, []);
});

test('slots: today, a time that is too soon is closed', async () => {
  assert.equal(await state(d1.id, TODAY, '10:00'), 'closed', 'it is 10:00 now and a 15 minute lead is required');
  assert.equal(await state(d1.id, TODAY, '10:20'), 'open');
});

test('slots: the past and the far future are closed with a reason', async () => {
  const past = await slots(d1.id, '2026-11-01');
  assert.deepEqual(past.slots, []);
  assert.match(past.note, /passed/);
  const far = await slots(d1.id, '2026-12-08'); // a Tuesday, 36 days out
  assert.deepEqual(far.slots, []);
  assert.match(far.note, /30 days/);
  assert.ok((await slots(d1.id, '2026-12-01')).slots.length > 0, '29 days ahead is still fine');
});

test('slots: leave and switched-off branches remove them', async () => {
  const put = (body) => api('PUT', `/api/doctors/${d1.id}/schedule`, { token: managerToken, body });
  const base = { acceptsOnlineBooking: false, sessions: [{ branchId: branch.id, weekday: 1, startTime: '10:00', endTime: '12:00', slotMinutes: 20 }, { branchId: branch.id, weekday: 2, startTime: '09:00', endTime: '10:00', slotMinutes: 30 }] };
  assert.equal((await put({ ...base, onLeaveUntil: '2026-11-10' })).status, 200);
  const leave = await slots(d1.id, NEXT_MON);
  assert.deepEqual(leave.slots, []);
  assert.match(leave.note, /leave until 2026-11-10/);
  assert.ok((await slots(d1.id, '2026-11-16')).slots.length > 0, 'after the leave ends the slots are back');
  assert.equal((await put(base)).status, 200);

  const other = (await api('POST', '/api/branches', { token: managerToken, body: { name: 'Off Branch' } })).body.id;
  await put({ ...base, sessions: [...base.sessions, { branchId: other, weekday: 3, startTime: '10:00', endTime: '11:00', slotMinutes: 20 }] });
  assert.equal((await slots(d1.id, '2026-11-11')).slots.length, 3);
  await api('PUT', `/api/branches/${other}`, { token: managerToken, body: { name: 'Off Branch', isActive: false } });
  assert.deepEqual((await slots(d1.id, '2026-11-11')).slots, [], 'a switched-off branch offers nothing');
  assert.equal((await put(base)).status, 200);
});

test('slots: onlyOpen hides everything that is not bookable', async () => {
  const open = await slots(d1.id, TODAY, true);
  assert.ok(open.slots.length > 0 && open.slots.every((s) => s.state === 'open'));
  assert.ok(!open.slots.some((s) => s.time === '10:00'));
});

// =============================================================================
// Booking
// =============================================================================

let first; // the 10:00 booking on 9 Nov, kept for the no-show test

test('book: a slot is taken, listed, and no longer open', async () => {
  const r = await book(d1.id, NEXT_MON, '10:00', { patientId: seedPatients[0].id, newPatient: undefined });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  first = r.body;
  assert.equal(r.body.status, 'booked');
  assert.equal(r.body.time, '10:00');
  assert.equal(r.body.branchName, branch.name);
  assert.equal(r.body.patientId, seedPatients[0].id);
  assert.equal(await state(d1.id, NEXT_MON, '10:00'), 'booked');
  const list = (await api('GET', `/api/bookings?date=${NEXT_MON}&doctorId=${d1.id}`, as('reception'))).body;
  assert.ok(list.some((b) => b.id === first.id && b.patientName));
});

test('book: the same slot cannot be booked twice', async () => {
  const r = await book(d1.id, NEXT_MON, '10:00');
  assert.equal(r.status, 409);
  assert.match(r.body.errors[0], /already booked/);
});

test('book: when eight people choose the same slot at once, exactly one gets it and the others leave no trace', async () => {
  const before = (await api('GET', '/api/patients', as('reception'))).body.length;
  const results = await Promise.all(Array.from({ length: 8 }, () => book(d1.id, NEXT_MON, '10:20')));
  const won = results.filter((r) => r.status === 200);
  const lost = results.filter((r) => r.status === 409);
  assert.equal(won.length, 1, `statuses: ${results.map((r) => r.status)}`);
  assert.equal(lost.length, 7);
  const after = (await api('GET', '/api/patients', as('reception'))).body.length;
  assert.equal(after, before + 1, 'the seven losers must not leave half-created patients behind');
  const day = (await api('GET', `/api/bookings?date=${NEXT_MON}&doctorId=${d1.id}&status=booked`, as('reception'))).body;
  assert.equal(day.filter((b) => b.time === '10:20').length, 1, 'one live booking in that slot');
});

const refused = (name, make, status, match) =>
  test(`book refused: ${name}`, async () => {
    const body = { doctorId: d1.id, date: NEXT_MON, time: '11:00', newPatient: fresh(), source: 'front_desk', ...make() };
    const r = await api('POST', '/api/bookings', { ...as('reception'), body });
    assert.equal(r.status, status, JSON.stringify(r.body));
    assert.match(r.body.errors.join(' '), match);
  });
refused('a time that is not on the grid', () => ({ time: '11:03' }), 400, /not on this doctor's schedule/);
refused('a time outside the session', () => ({ time: '14:00' }), 400, /not on this doctor's schedule/);
refused('a time the session has no room for', () => ({ time: '12:00' }), 400, /not on this doctor's schedule/);
refused('a date in the past', () => ({ date: '2026-11-01' }), 400, /passed/);
refused('a time that is too soon today', () => ({ date: TODAY, time: '10:00' }), 400, /passed or is too soon/);
refused('a doctor with no schedule', () => ({ doctorId: d2.id }), 400, /no session/i);
refused('a doctor that does not exist', () => ({ doctorId: 99999 }), 400, /does not exist/);
refused('a patient that does not exist', () => ({ newPatient: undefined, patientId: 99999 }), 400, /does not exist/);
refused('both an existing and a new patient', () => ({ patientId: seedPatients[1].id }), 400, /either an existing patient or/);
refused('neither an existing nor a new patient', () => ({ newPatient: undefined }), 400, /either an existing patient or/);
refused('a bad date', () => ({ date: '09/11/2026' }), 400, /date must look like/);
refused('a bad source', () => ({ source: 'carrier-pigeon' }), 400, /source must be/);
refused('a new patient without a phone number', () => ({ newPatient: { ...fresh(), phone: '' } }), 400, /phone/);
refused('a new patient with an impossible age', () => ({ newPatient: { ...fresh(), age: 400 } }), 400, /age/);
refused('an online channel for a doctor who has not switched online booking on', () => ({ source: 'app' }), 400, /does not take online bookings/);

test('book: the same patient cannot hold two slots with one doctor on one day', async () => {
  const r = await book(d1.id, NEXT_MON, '11:00', { patientId: seedPatients[0].id, newPatient: undefined });
  assert.equal(r.status, 409);
  assert.match(r.body.errors[0], /already has a booking/);
  assert.equal(await state(d1.id, NEXT_MON, '11:00'), 'open', 'the refused attempt did not take the slot');
});

test('book: an online channel works once the doctor allows it', async () => {
  await api('PUT', `/api/doctors/${d1.id}/schedule`, {
    token: managerToken,
    body: { acceptsOnlineBooking: true, sessions: [{ branchId: branch.id, weekday: 1, startTime: '10:00', endTime: '12:00', slotMinutes: 20 }, { branchId: branch.id, weekday: 2, startTime: '09:00', endTime: '10:00', slotMinutes: 30 }] },
  });
  const r = await book(d1.id, TUE, '09:00', { source: 'app' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.source, 'app');
});

// =============================================================================
// Cancel and move
// =============================================================================

test('cancel: the slot opens again and can be booked by someone else', async () => {
  const b = (await book(d1.id, NEXT_MON, '10:40')).body;
  assert.equal(await state(d1.id, NEXT_MON, '10:40'), 'booked');
  const c = await api('POST', `/api/bookings/${b.id}/cancel`, { ...as('reception'), body: { reason: 'patient called' } });
  assert.equal(c.status, 200);
  assert.equal(c.body.status, 'cancelled');
  assert.equal(c.body.cancelReason, 'patient called');
  assert.equal(await state(d1.id, NEXT_MON, '10:40'), 'open');
  assert.equal((await book(d1.id, NEXT_MON, '10:40')).status, 200, 'rebooking works');
  assert.equal((await api('POST', `/api/bookings/${b.id}/cancel`, { ...as('reception'), body: {} })).status, 409, 'cancelling twice is refused');
  assert.equal((await api('POST', '/api/bookings/99999/cancel', { ...as('reception'), body: {} })).status, 404);
});

test('move: the old slot frees, a taken or past target is refused and changes nothing', async () => {
  const b = (await book(d1.id, NEXT_MON, '11:20')).body;
  const taken = await api('PUT', `/api/bookings/${b.id}/move`, { ...as('reception'), body: { date: NEXT_MON, time: '10:00' } });
  assert.equal(taken.status, 409);
  const past = await api('PUT', `/api/bookings/${b.id}/move`, { ...as('reception'), body: { date: '2026-11-01', time: '10:00' } });
  assert.equal(past.status, 400);
  const stayed = (await api('GET', `/api/bookings?date=${NEXT_MON}&doctorId=${d1.id}`, as('reception'))).body.find((x) => x.id === b.id);
  assert.equal(stayed.time, '11:20', 'a refused move leaves the booking where it was');

  const ok = await api('PUT', `/api/bookings/${b.id}/move`, { ...as('reception'), body: { date: NEXT_MON, time: '11:40' } });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.time, '11:40');
  assert.equal(await state(d1.id, NEXT_MON, '11:20'), 'open');
  assert.equal(await state(d1.id, NEXT_MON, '11:40'), 'booked');

  const other = await api('PUT', `/api/bookings/${b.id}/move`, { ...as('reception'), body: { date: TUE, time: '09:30' } });
  assert.equal(other.status, 200, 'it can move to another day too');
  assert.equal(other.body.date, TUE);

  await api('POST', `/api/bookings/${b.id}/cancel`, { ...as('reception'), body: {} });
  assert.equal((await api('PUT', `/api/bookings/${b.id}/move`, { ...as('reception'), body: { date: NEXT_MON, time: '11:20' } })).status, 409, 'a cancelled booking cannot be moved');
});

// =============================================================================
// Arrival turns a booking into a queue token
// =============================================================================

let arrivals = [];

test('arrive: a booking for today becomes the next token in that doctor\'s queue', async () => {
  const b = (await book(d1.id, TODAY, '10:20', { reason: 'fever for two days' })).body;
  const before = (await api('GET', '/api/queue', as('doctor1'))).body;
  const maxBefore = Math.max(0, ...before.map((q) => q.token_number));

  const a = await api('POST', `/api/bookings/${b.id}/arrive`, as('reception'));
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.equal(a.body.status, 'arrived');
  assert.equal(a.body.tokenNumber, maxBefore + 1);
  arrivals.push(a.body);

  const row = (await api('GET', '/api/queue', as('doctor1'))).body.find((q) => q.id === a.body.appointmentId);
  assert.ok(row, 'the patient is in the doctor\'s queue');
  assert.equal(row.status, 'Waiting');
  assert.equal(row.chief_complaint, 'fever for two days');
  assert.equal(row.patient_id, b.patientId);
  assert.equal(await state(d1.id, TODAY, '10:20'), 'booked', 'an arrived patient still holds the slot');
});

test('arrive: twice is refused, a future booking is refused, and cancelled ones are refused', async () => {
  assert.equal((await api('POST', `/api/bookings/${arrivals[0].id}/arrive`, as('reception'))).status, 409);
  assert.equal((await api('POST', `/api/bookings/${first.id}/arrive`, as('reception'))).status, 400, 'a booking for next week cannot be checked in today');
  const c = (await book(d1.id, TODAY, '10:40')).body;
  await api('POST', `/api/bookings/${c.id}/cancel`, { ...as('reception'), body: {} });
  assert.equal((await api('POST', `/api/bookings/${c.id}/arrive`, as('reception'))).status, 409);
});

test('arrive: two check-ins at the same moment get different tokens', async () => {
  const x = (await book(d1.id, TODAY, '11:00')).body;
  const y = (await book(d1.id, TODAY, '11:20')).body;
  const [a, b] = await Promise.all([x, y].map((bk) => api('POST', `/api/bookings/${bk.id}/arrive`, as('reception'))));
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.notEqual(a.body.tokenNumber, b.body.tokenNumber);
  const tokens = (await api('GET', '/api/queue', as('doctor1'))).body.map((q) => q.token_number);
  assert.equal(new Set(tokens).size, tokens.length, 'no two people in a queue share a number');
});

// =============================================================================
// No-show
// =============================================================================

test('no-show: refused before the appointment time, allowed after it', async () => {
  const todayLater = (await book(d1.id, TODAY, '11:40')).body;
  const early = await api('POST', `/api/bookings/${todayLater.id}/no-show`, as('reception'));
  assert.equal(early.status, 400);
  assert.match(early.body.errors[0], /time has passed/);

  // the same database, with the clock moved to 11:00 on 9 Nov: the 10:00 booking is over, the 11:40 one is not
  await startApi({ dbName: stack.dbName, port: 5159, env: { Auth__Enforce: 'true', Booking__FakeNow: `${NEXT_MON}T11:00:00` } });
  const gone = await call(LATER, 'POST', `/api/bookings/${first.id}/no-show`, as('reception'));
  assert.equal(gone.status, 200, JSON.stringify(gone.body));
  assert.equal(gone.body.status, 'no_show');
  const stillAhead = (await api('GET', `/api/bookings?date=${NEXT_MON}&doctorId=${d1.id}&status=booked`, as('reception'))).body.find((b) => b.time === '11:40');
  if (stillAhead) assert.equal((await call(LATER, 'POST', `/api/bookings/${stillAhead.id}/no-show`, as('reception'))).status, 400);
  assert.equal((await call(LATER, 'POST', `/api/bookings/${first.id}/no-show`, as('reception'))).status, 409, 'only a booked appointment can become a no-show');
});

// =============================================================================
// The list, and who may do what
// =============================================================================

test('list: filters by date, doctor and status', async () => {
  const all = (await api('GET', `/api/bookings?date=${NEXT_MON}`, as('reception'))).body;
  assert.ok(all.length >= 3 && all.every((b) => b.date === NEXT_MON));
  const cancelled = (await api('GET', `/api/bookings?date=${NEXT_MON}&status=cancelled`, as('reception'))).body;
  assert.ok(cancelled.every((b) => b.status === 'cancelled'));
  assert.equal((await api('GET', `/api/bookings?date=${NEXT_MON}&doctorId=${d2.id}`, as('reception'))).body.length, 0);
  assert.equal((await api('GET', '/api/bookings?date=nonsense', as('reception'))).status, 400);
  const byPatient = (await api('GET', `/api/bookings?patientId=${seedPatients[0].id}`, as('reception'))).body;
  assert.ok(byPatient.length >= 1 && byPatient.every((b) => b.patientId === seedPatients[0].id));
});

test('roles: only the front desk and the manager may book, move, cancel or check in', async () => {
  const body = { doctorId: d1.id, date: NEXT_MON, time: '11:00', newPatient: fresh() };
  for (const name of ['doctor1', 'assistant1', 'pharmacist']) {
    assert.equal((await api('POST', '/api/bookings', { ...as(name), body })).status, 403, name);
    assert.equal((await api('POST', `/api/bookings/${first.id}/cancel`, { ...as(name), body: {} })).status, 403, name);
    assert.equal((await api('POST', `/api/bookings/${first.id}/arrive`, as(name))).status, 403, name);
  }
  assert.equal((await api('POST', '/api/bookings', { ...as('manager'), body })).status, 200, 'the manager may book');
});

test('roles: a doctor and their assistant read only their own doctor\'s bookings', async () => {
  const mine = (await api('GET', `/api/bookings?date=${NEXT_MON}`, as('doctor1'))).body;
  assert.ok(mine.length > 0 && mine.every((b) => b.doctorId === d1.id));
  assert.equal((await api('GET', `/api/bookings?date=${NEXT_MON}&doctorId=${d2.id}`, as('doctor1'))).status, 403);
  assert.equal((await api('GET', `/api/bookings?date=${NEXT_MON}&doctorId=${d1.id}`, as('assistant1'))).status, 200);
  assert.equal((await api('GET', `/api/bookings?date=${NEXT_MON}&doctorId=${d1.id}`, as('doctor2'))).status, 403, 'doctor 2 cannot read doctor 1\'s bookings');
  const theirs = (await api('GET', `/api/bookings?date=${NEXT_MON}`, as('doctor2'))).body;
  assert.deepEqual(theirs, [], 'doctor 2 has none and sees none of doctor 1\'s');
  assert.equal((await api('GET', `/api/bookings?date=${NEXT_MON}`, as('pharmacist'))).status, 403);
  assert.equal((await api('GET', `/api/slots?doctorId=${d1.id}&date=${NEXT_MON}`, as('pharmacist'))).status, 403);
  assert.equal((await api('GET', `/api/slots?doctorId=${d1.id}&date=${NEXT_MON}`, as('doctor1'))).status, 200);
  assert.equal((await api('GET', `/api/bookings?date=${NEXT_MON}`)).status, 401, 'signed-out callers get nothing');
});
