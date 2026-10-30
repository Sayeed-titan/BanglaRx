#!/usr/bin/env node
/**
 * One whole day of the clinic, role by role, against a real API and a throw-away database.
 *
 *   node tests/run-fullcycle-tests.mjs
 *
 * Manager sets up -> a patient books on the phone -> reception checks them in -> the doctor writes the prescription ->
 * the pharmacist hands over -> the patient sees it. Between the steps, each role is also shown the doors that are
 * shut to it. "Now" is frozen at Monday 2026-11-02 10:00 clinic time. Passwords are random and exist only in the throw-away DB.
 * (The AI dictation step needs a Gemini key and is covered by run-dictation-tests.mjs.)
 */
import { randomBytes } from 'node:crypto';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startStack, stopStack } from './lib/test-stack.mjs';

const BASE = 'http://localhost:5180';
const pw = () => `Tst-${randomBytes(9).toString('base64url')}-9z`;
const TODAY = '2026-11-02'; // Monday

const call = async (method, path, { token, body } = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not json */ }
  return { status: res.status, body: json, text };
};
const as = (name) => ({ token: who[name].token });

let stack, d1, d2, branch;
const who = {};
const flow = {}; // what one step hands to the next

async function account(name, role, doctorId) {
  const temp = pw(), final = pw(), username = `${name}.${randomBytes(2).toString('hex')}`;
  const made = await call('POST', '/api/users', { ...as('manager'), body: { username, displayName: name, role, doctorId, password: temp } });
  assert.equal(made.status, 200, JSON.stringify(made.body));
  const first = await call('POST', '/api/auth/login', { body: { username, password: temp } });
  const changed = await call('POST', '/api/auth/change-password', { token: first.body.token, body: { currentPassword: temp, newPassword: final } });
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
  who[name] = { token: changed.body.token, id: made.body.id };
}

const rx = (doctorId, patientId, brand) => ({
  doctorId, patientId, chiefComplaints: ['Fever for two days'], diagnosis: 'Viral fever', adviceBangla: ['Drink plenty of water'],
  items: [{ brandName: brand, genericName: 'Paracetamol', form: 'Tablet', strength: '500mg', dosagePattern: '1+1+1', duration: '5 days', instructionsBangla: 'after meals' }],
  investigations: [],
});

before(async () => {
  stack = await startStack({ port: 5180, env: { Auth__Enforce: 'true', Sms__Provider: 'test', Booking__FakeNow: `${TODAY}T10:00:00`, Patient__CodesPerIpPer10Min: '1000' } });
});
after(async () => {
  await stopStack();
});

// ---- 1. Manager: first setup, accounts, schedule --------------------------------------------------------------------

test('1 manager: first-time setup, then the whole team gets accounts', async () => {
  const setup = await call('POST', '/api/auth/setup', { body: { username: 'boss.fc', displayName: 'Boss', password: pw() } });
  assert.equal(setup.status, 200, JSON.stringify(setup.body));
  who.manager = { token: setup.body.token };
  assert.equal((await call('POST', '/api/auth/setup', { body: { username: 'boss2', displayName: 'X', password: pw() } })).status, 409, 'setup runs once');

  [d1, d2] = (await call('GET', '/api/doctors', as('manager'))).body;
  [branch] = (await call('GET', '/api/branches', as('manager'))).body;
  await account('reception', 'receptionist');
  await account('doctor1', 'doctor', d1.id);
  await account('doctor2', 'doctor', d2.id);
  await account('assistant1', 'assistant', d1.id);
  await account('pharmacist', 'pharmacist');
  const users = await call('GET', '/api/users', as('manager'));
  assert.equal(users.status, 200);
  assert.ok(users.body.length >= 6);
});

test('2 manager: gives doctor 1 a Monday session open to online booking', async () => {
  const r = await call('PUT', `/api/doctors/${d1.id}/schedule`, {
    ...as('manager'),
    body: { acceptsOnlineBooking: true, sessions: [{ branchId: branch.id, weekday: 1, startTime: '10:30', endTime: '12:00', slotMinutes: 30 }] },
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
});

// ---- 2. Patient: phone sign-in, a person, consent, booking --------------------------------------------------------------

test('3 patient: signs in by phone code, adds themself, answers the consent question', async () => {
  const phone = '01711223344';
  assert.equal((await call('POST', '/api/patient/auth/request-code', { body: { phone } })).status, 200);
  const sms = await call('GET', `/api/_test/sms?phone=${encodeURIComponent('+88' + phone)}`);
  const code = sms.body.message.match(/\b(\d{6})\b/)[1];
  const v = await call('POST', '/api/patient/auth/verify', { body: { phone, code } });
  assert.equal(v.status, 200, JSON.stringify(v.body));
  who.patient = { token: v.body.token };

  const p = await call('POST', '/api/patient/profiles', { ...as('patient'), body: { fullName: 'Rubina Akter', age: 24, gender: 'Female' } });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  flow.profile = p.body.profiles[0];
  assert.equal((await call('POST', '/api/patient/consent', { ...as('patient'), body: { recordVisit: true, reminders: true, storeReports: false } })).status, 200);
});

test('4 patient: finds the doctor and books the first free time today', async () => {
  const doctors = (await call('GET', '/api/patient/doctors', as('patient'))).body;
  const card = doctors.find((d) => d.id === d1.id);
  assert.ok(card, 'doctor 1 is offered online');
  assert.equal(doctors.find((d) => d.id === d2.id), undefined, 'a doctor with no schedule is not offered');
  const slots = (await call('GET', `/api/patient/slots?doctorId=${d1.id}&date=${TODAY}`, as('patient'))).body;
  const open = (slots.slots ?? slots).find((s) => s.state === 'open' || s.state === 'free' || s.open);
  assert.ok(open, `an open slot exists: ${JSON.stringify(slots).slice(0, 200)}`);
  const b = await call('POST', '/api/patient/bookings', { ...as('patient'), body: { doctorId: d1.id, date: TODAY, time: open.time, profileId: flow.profile.id, reason: 'fever for two days' } });
  assert.equal(b.status, 200, JSON.stringify(b.body));
  flow.booking = b.body.booking ?? b.body;
  assert.equal((await call('GET', '/api/patient/bookings', as('patient'))).body.length, 1);
});

// ---- 3. Reception: sees the booking, checks the patient in ------------------------------------------------------------------

test('5 reception: sees the booking and checks the patient in; the token lands in doctor 1\'s queue only', async () => {
  const list = (await call('GET', `/api/bookings?date=${TODAY}`, as('reception'))).body;
  const mine = list.find((x) => x.id === flow.booking.id);
  assert.ok(mine, 'the phone booking shows at the front desk');
  const a = await call('POST', `/api/bookings/${mine.id}/arrive`, as('reception'));
  assert.equal(a.status, 200, JSON.stringify(a.body));
  flow.tokenNo = a.body.tokenNumber;
  flow.patientId = mine.patientId;

  const q1 = (await call('GET', '/api/queue', as('doctor1'))).body;
  const row = q1.find((q) => q.patient_id === flow.patientId);
  assert.ok(row && row.status === 'Waiting');
  flow.apptId = row.id;
  assert.equal((await call('GET', '/api/queue', as('doctor2'))).body.some((q) => q.patient_id === flow.patientId), false, 'doctor 2 never sees doctor 1\'s patient');
  const patientCard = await call('GET', `/api/patient/queue`, as('patient'));
  assert.equal(patientCard.status, 200);
  assert.ok(patientCard.body.length >= 1, 'the patient sees their place in line');
});

// ---- 4. Doctor: writes and signs the prescription --------------------------------------------------------------------

test('6 doctor 1: opens the consent flag, writes the prescription; doctor 2 cannot touch it', async () => {
  const consent = await call('GET', `/api/patients/${flow.patientId}/consent`, as('doctor1'));
  assert.equal(consent.status, 200);
  assert.equal(consent.body.recordVisit, 'agreed');

  const made = await call('POST', '/api/prescriptions', { ...as('doctor1'), body: rx(d1.id, flow.patientId, 'Napa') });
  assert.equal(made.status, 200, JSON.stringify(made.body));
  flow.rxId = made.body.prescriptionId;

  assert.equal((await call('GET', `/api/prescriptions/${flow.rxId}`, as('doctor2'))).status, 403, 'another doctor is refused');
  assert.equal((await call('PUT', `/api/prescriptions/${flow.rxId}`, { ...as('doctor2'), body: rx(d2.id, flow.patientId, 'Ace') })).status, 403);
  assert.equal((await call('POST', '/api/prescriptions', { ...as('doctor2'), body: rx(d1.id, flow.patientId, 'Ace') })).status, 403, 'cannot write into another chamber');
  assert.equal((await call('POST', '/api/prescriptions', { ...as('reception'), body: rx(d1.id, flow.patientId, 'Ace') })).status, 403, 'reception cannot write a prescription');
  assert.equal((await call('POST', '/api/prescriptions', { ...as('assistant1'), body: rx(d1.id, flow.patientId, 'Ace') })).status, 403, 'an assistant drafts but does not sign');
});

test('7 assistant: reads their own doctor\'s chamber, not another\'s', async () => {
  assert.equal((await call('GET', '/api/queue', as('assistant1'))).status, 200);
  assert.equal((await call('GET', '/api/queue?doctorId=' + d2.id, as('assistant1'))).status, 403);
  assert.equal((await call('GET', `/api/prescriptions/${flow.rxId}`, as('assistant1'))).status, 200);
});

// ---- 5. Pharmacist: sees the signed prescription, no diagnosis; hands over --------------------------------------------------

test('8 pharmacist: sees what to hand over without the diagnosis, records the hand-over', async () => {
  const list = (await call('GET', '/api/pharmacy/prescriptions', as('pharmacist'))).body;
  assert.ok(list.some((x) => x.id === flow.rxId));
  const detail = await call('GET', `/api/pharmacy/prescriptions/${flow.rxId}`, as('pharmacist'));
  assert.equal(detail.status, 200);
  assert.equal(JSON.stringify(detail.body).includes('Viral fever'), false, 'the diagnosis is not shown to the pharmacy');
  const d = await call('POST', `/api/pharmacy/prescriptions/${flow.rxId}/dispense`, { ...as('pharmacist'), body: { items: [{ brandName: 'Napa' }], note: 'full strip' } });
  assert.equal(d.status, 200, JSON.stringify(d.body));
  assert.equal(d.body.recorded, 1);
  assert.equal((await call('GET', '/api/queue', as('pharmacist'))).status, 403, 'a pharmacist has no queue');
  assert.equal((await call('GET', '/api/patients', as('pharmacist'))).status, 403, 'a pharmacist has no patient list');
});

// ---- 6. Patient: sees the prescription on the phone -------------------------------------------------------------------

test('9 patient: sees the signed prescription, with other brands of the same medicine', async () => {
  const list = (await call('GET', '/api/patient/prescriptions', as('patient'))).body;
  assert.equal(list.length, 1);
  assert.equal(list[0].doctorName, d1.name);
  assert.equal(list[0].medicines[0].brandName, 'Napa');
  assert.ok(Array.isArray(list[0].medicines[0].sameIngredient));
});

// ---- 7. The doors that stay shut ---------------------------------------------------------------------------------------------

test('10 role matrix: every role gets only its own doors', async () => {
  const cases = [
    // [who, method, path, expected]
    ['reception', 'GET', '/api/users', 403],
    ['reception', 'GET', '/api/prescriptions', 403],
    ['reception', 'GET', '/api/queue', 200],
    ['reception', 'GET', '/api/pharmacy/prescriptions', 403],
    ['doctor1', 'GET', '/api/users', 403],
    ['doctor1', 'PUT', `/api/doctors/${d1.id}/schedule`, 403],
    ['doctor1', 'GET', '/api/pharmacy/prescriptions', 403],
    ['doctor1', 'POST', '/api/bookings', 403],
    ['assistant1', 'GET', '/api/users', 403],
    ['pharmacist', 'GET', '/api/prescriptions', 403],
    ['pharmacist', 'GET', '/api/bookings', 403],
    ['pharmacist', 'GET', '/api/inbox', 403],
    ['manager', 'GET', '/api/users', 200],
    ['manager', 'GET', '/api/pharmacy/prescriptions', 200],
    ['patient', 'GET', '/api/queue', 401],
    ['patient', 'GET', '/api/patients', 401],
    ['patient', 'GET', '/api/users', 401],
  ];
  for (const [name, method, path, want] of cases) {
    const r = await call(method, path, { ...as(name), body: method === 'POST' ? {} : undefined });
    assert.equal(r.status, want, `${name} ${method} ${path} -> ${r.status}, wanted ${want}`);
  }
  for (const path of ['/api/queue', '/api/patients', '/api/prescriptions', '/api/doctors', '/api/bookings']) {
    assert.equal((await call('GET', path)).status, 401, `${path} with no sign-in`);
  }
});

test('11 sign-out ends the session; a disabled account is cut off at once', async () => {
  assert.equal((await call('POST', '/api/auth/logout', as('assistant1'))).status < 300, true);
  assert.equal((await call('GET', '/api/queue', as('assistant1'))).status, 401, 'signed out means signed out');
  const off = await call('PUT', `/api/users/${who.pharmacist.id}`, { ...as('manager'), body: { isActive: false } });
  assert.ok(off.status < 300, JSON.stringify(off.body));
  assert.equal((await call('GET', '/api/pharmacy/prescriptions', as('pharmacist'))).status, 401, 'a disabled pharmacist is out immediately');
});
