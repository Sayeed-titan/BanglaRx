#!/usr/bin/env node
/**
 * Patient sign-in and the patient side of booking, against a real API and a throw-away database.
 *
 *   node tests/run-patient-tests.mjs
 *
 * The API runs with Sms__Provider=test, so a test can read the code a real patient would get by SMS
 * (that route does not exist in any other mode). "Now" is frozen at Monday 2026-11-02 10:00 clinic time.
 * A small fake SMS gateway proves the "http" provider sends what a real gateway expects.
 */
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startStack, startApi, stopStack } from './lib/test-stack.mjs';

const BASE = 'http://localhost:5160';
const SHORT = 'http://localhost:5161'; // codes live 2 seconds
const GATEWAY_API = 'http://localhost:5162'; // sends SMS through the fake gateway
const LOGMODE = 'http://localhost:5163'; // default provider: log
const OFF = 'http://localhost:5164'; // staff sign-in enforcement off
const MOCK_PORT = 5170;
const pw = () => `Tst-${randomBytes(9).toString('base64url')}-9z`;

const TODAY = '2026-11-02';
const NEXT_MON = '2026-11-09';

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
const api = (m, p, o) => call(BASE, m, p, o);

let seedSession, stack, managerToken, receptionToken, d1, d2, branch;
const seenCodes = [];
let counter = 0;
const newPhone = () => `017${String(10000000 + ++counter * 7919).slice(-8)}`; // 017 + 8 digits, a fresh number per call

const codeFor = async (base, normalized) => {
  const r = await call(base, 'GET', `/api/_test/sms?phone=${encodeURIComponent(normalized)}`);
  assert.equal(r.status, 200, `no SMS was sent to ${normalized}`);
  const code = r.body.message.match(/\b(\d{6})\b/)[1];
  seenCodes.push(code);
  return code;
};
const norm = (p) => `+88${p}`;

/** a full sign-in; returns { token, phone, profiles } */
async function signIn(phone = newPhone(), base = BASE) {
  const sent = await call(base, 'POST', '/api/patient/auth/request-code', { body: { phone } });
  assert.equal(sent.status, 200, JSON.stringify(sent.body));
  const code = await codeFor(base, norm(phone));
  const v = await call(base, 'POST', '/api/patient/auth/verify', { body: { phone, code } });
  assert.equal(v.status, 200, JSON.stringify(v.body));
  return { ...v.body, base };
}
const asP = (s) => ({ token: s.token });

before(async () => {
  stack = await startStack({ port: 5160, env: { Auth__Enforce: 'true', Sms__Provider: 'test', Booking__FakeNow: `${TODAY}T10:00:00`, Patient__CodesPerIpPer10Min: '1000' } });
  const setup = await api('POST', '/api/auth/setup', { body: { username: 'boss.pt', displayName: 'Boss', password: pw() } });
  managerToken = setup.body.token;
  [d1, d2] = (await api('GET', '/api/doctors', { token: managerToken })).body;
  [branch] = (await api('GET', '/api/branches', { token: managerToken })).body;
  // the front desk, for check-ins
  const temp = pw(), final = pw(), username = 'desk.pt';
  await api('POST', '/api/users', { token: managerToken, body: { username, displayName: 'Desk', role: 'receptionist', password: temp } });
  const first = await api('POST', '/api/auth/login', { body: { username, password: temp } });
  receptionToken = (await api('POST', '/api/auth/change-password', { token: first.body.token, body: { currentPassword: temp, newPassword: final } })).body.token;
});
after(async () => {
  await stopStack();
});

const schedule = (doctorId, online) =>
  api('PUT', `/api/doctors/${doctorId}/schedule`, {
    token: managerToken,
    body: { acceptsOnlineBooking: online, sessions: [{ branchId: branch.id, weekday: 1, startTime: '10:00', endTime: '12:00', slotMinutes: 20 }] },
  });

// =============================================================================
// Phone numbers and the code
// =============================================================================

test('phone: only real Bangladesh mobile numbers are accepted', async () => {
  for (const bad of ['', '12345', '01212345678', '0171234567', '+8801', 'hello', null, '+4915112345678']) {
    const r = await api('POST', '/api/patient/auth/request-code', { body: { phone: bad } });
    assert.equal(r.status, 400, `${bad} should be refused`);
    assert.match(r.body.errors[0], /Bangladesh mobile number/);
  }
});

test('phone: every way of typing a number reaches the same account', async () => {
  const digits = '01733445566';
  const r = await api('POST', '/api/patient/auth/request-code', { body: { phone: '+880 1733-445566' } });
  assert.equal(r.status, 200);
  assert.ok((await codeFor(BASE, norm(digits))), 'the SMS went to the normalised number');
  const code = seenCodes.at(-1);
  const v = await api('POST', '/api/patient/auth/verify', { body: { phone: '8801733445566', code } });
  assert.equal(v.status, 200, 'verifying with another spelling of the same number works');
  assert.equal(v.body.phone, '+8801733445566');
});

test('code: asking for one never reveals the code, or whether the number is known', async () => {
  const known = await api('POST', '/api/patient/auth/request-code', { body: { phone: '01819000111' } }); // a seed patient's number
  const unknown = await api('POST', '/api/patient/auth/request-code', { body: { phone: newPhone() } });
  assert.deepEqual(known.body, unknown.body, 'the reply is the same either way');
  assert.deepEqual(Object.keys(known.body).sort(), ['expiresInSeconds', 'sent']);
  assert.ok(!/\b\d{6}\b/.test(known.text), 'the code is only ever in the SMS');
});

test('code: wrong, right, and then it is spent', async () => {
  const phone = newPhone();
  await api('POST', '/api/patient/auth/request-code', { body: { phone } });
  const code = await codeFor(BASE, norm(phone));
  const wrong = code === '000000' ? '111111' : '000000';
  assert.equal((await api('POST', '/api/patient/auth/verify', { body: { phone, code: wrong } })).status, 401);
  assert.equal((await api('POST', '/api/patient/auth/verify', { body: { phone, code: '12ab56' } })).status, 401);
  const ok = await api('POST', '/api/patient/auth/verify', { body: { phone, code } });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token);
  assert.equal((await api('POST', '/api/patient/auth/verify', { body: { phone, code } })).status, 401, 'a code works once');
});

test('code: five wrong guesses kill it, even for the right code', async () => {
  const phone = newPhone();
  await api('POST', '/api/patient/auth/request-code', { body: { phone } });
  const code = await codeFor(BASE, norm(phone));
  const wrong = code === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++) assert.equal((await api('POST', '/api/patient/auth/verify', { body: { phone, code: wrong } })).status, 401);
  assert.equal((await api('POST', '/api/patient/auth/verify', { body: { phone, code } })).status, 401, 'guessing is not allowed to continue');
  await api('POST', '/api/patient/auth/request-code', { body: { phone } });
  assert.equal((await api('POST', '/api/patient/auth/verify', { body: { phone, code: await codeFor(BASE, norm(phone)) } })).status, 200, 'a fresh code starts clean');
});

test('code: only the newest code works', async () => {
  const phone = newPhone();
  await api('POST', '/api/patient/auth/request-code', { body: { phone } });
  const first = await codeFor(BASE, norm(phone));
  await api('POST', '/api/patient/auth/request-code', { body: { phone } });
  const second = await codeFor(BASE, norm(phone));
  if (first !== second) assert.equal((await api('POST', '/api/patient/auth/verify', { body: { phone, code: first } })).status, 401, 'the older code is dead');
  assert.equal((await api('POST', '/api/patient/auth/verify', { body: { phone, code: second } })).status, 200);
});

test('code: asking too often is refused', async () => {
  const phone = newPhone();
  for (let i = 0; i < 3; i++) assert.equal((await api('POST', '/api/patient/auth/request-code', { body: { phone } })).status, 200);
  const fourth = await api('POST', '/api/patient/auth/request-code', { body: { phone } });
  assert.equal(fourth.status, 429);
  assert.match(fourth.body.errors[0], /wait a few minutes/);
});

test('code: it expires', async () => {
  await startApi({ dbName: stack.dbName, port: 5161, env: { Auth__Enforce: 'true', Sms__Provider: 'test', Patient__OtpSeconds: '2' } });
  const phone = newPhone();
  await call(SHORT, 'POST', '/api/patient/auth/request-code', { body: { phone } });
  const code = await codeFor(SHORT, norm(phone));
  await new Promise((r) => setTimeout(r, 3200));
  assert.equal((await call(SHORT, 'POST', '/api/patient/auth/verify', { body: { phone, code } })).status, 401);
});

// =============================================================================
// Accounts, family and token separation
// =============================================================================

test('profiles: patient records the clinic already holds under this number become theirs', async () => {
  const s = (seedSession = await signIn('01819000111'));
  const names = s.profiles.map((p) => p.fullName);
  assert.ok(names.includes('Md. Kabir Hossain'), `got ${names}`);
  assert.equal(s.profiles[0].link, 'phone_match');
  const stranger = await signIn();
  assert.deepEqual(stranger.profiles, [], 'a new number starts with nobody');
  assert.ok(!JSON.stringify(stranger).includes('Kabir'), 'and sees nobody else\'s records');
});

test('profiles: a family member can be added, with validation and a limit', async () => {
  const s = await signIn();
  for (const bad of [{ fullName: '', age: 5, gender: 'Male' }, { fullName: 'X', age: 400, gender: 'Male' }, { fullName: 'X', age: 5, gender: 'Robot' }]) {
    assert.equal((await api('POST', '/api/patient/profiles', { ...asP(s), body: bad })).status, 400);
  }
  const added = await api('POST', '/api/patient/profiles', { ...asP(s), body: { fullName: 'Nusrat Jahan', age: 7, gender: 'Female' } });
  assert.equal(added.status, 200);
  assert.equal(added.body.profiles.length, 1);
  assert.equal(added.body.profiles[0].link, 'added_by_patient');
  const staffView = (await api('GET', '/api/patients', { token: receptionToken })).body.find((p) => p.full_name === 'Nusrat Jahan');
  assert.equal(staffView.phone, s.phone, 'the clinic record carries the verified number');
  assert.equal(staffView.blood_group, 'Unknown', 'nothing is invented');
  for (let i = 0; i < 9; i++) await api('POST', '/api/patient/profiles', { ...asP(s), body: { fullName: `Family ${i}`, age: 30, gender: 'Other' } });
  assert.equal((await api('POST', '/api/patient/profiles', { ...asP(s), body: { fullName: 'One too many', age: 30, gender: 'Other' } })).status, 400);
});

test('tokens: a patient token opens patient routes only, and a staff token never does', async () => {
  const s = await signIn();
  assert.equal((await api('GET', '/api/patient/me', asP(s))).status, 200);
  assert.equal((await api('GET', '/api/patient/me')).status, 401);
  assert.equal((await api('GET', '/api/patient/me', { token: 'junk' })).status, 401);
  for (const path of ['/api/doctors', '/api/patients', '/api/queue', '/api/prescriptions', '/api/bookings', '/api/users']) {
    assert.equal((await api('GET', path, asP(s))).status, 401, `${path} must refuse a patient token`);
  }
  assert.equal((await api('GET', '/api/patient/me', { token: managerToken })).status, 401, 'a manager token is not a patient token');
  const parts = s.token.split('.');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  payload.sub = '1';
  const forged = [parts[0], Buffer.from(JSON.stringify(payload)).toString('base64url'), parts[2]].join('.');
  assert.equal((await api('GET', '/api/patient/me', { token: forged })).status, 401, 'changing the account inside a token breaks it');
});

test('tokens: signing out ends the session on the server', async () => {
  const s = await signIn();
  assert.equal((await api('POST', '/api/patient/auth/logout', asP(s))).status, 204);
  assert.equal((await api('GET', '/api/patient/me', asP(s))).status, 401);
});

// =============================================================================
// Finding a doctor and booking
// =============================================================================

test('doctors: nobody is offered until a doctor has a schedule and has switched online booking on', async () => {
  const s = await signIn();
  assert.deepEqual((await api('GET', '/api/patient/doctors', asP(s))).body, []);
  assert.equal((await schedule(d1.id, false)).status, 200);
  assert.deepEqual((await api('GET', '/api/patient/doctors', asP(s))).body, [], 'a schedule alone is not enough');
  assert.equal((await schedule(d1.id, true)).status, 200);
  const list = (await api('GET', '/api/patient/doctors', asP(s))).body;
  assert.equal(list.length, 1);
  assert.equal(list[0].id, d1.id);
  assert.deepEqual(list[0].nextFree, { date: TODAY, time: '10:20', branch: branch.name }, 'the next free time is worked out from the clock and the schedule');
  assert.ok(!/phone|email|bmdc/i.test(JSON.stringify(list)), 'no private doctor details');
});

test('slots: a patient sees only free times, and only for doctors who take online bookings', async () => {
  const s = await signIn();
  const day = (await api('GET', `/api/patient/slots?doctorId=${d1.id}&date=${NEXT_MON}`, asP(s))).body;
  assert.deepEqual(day.slots.map((x) => x.time), ['10:00', '10:20', '10:40', '11:00', '11:20', '11:40']);
  assert.ok(day.slots.every((x) => x.state === 'open' && x.bookingId === undefined));
  assert.equal((await api('GET', `/api/patient/slots?doctorId=${d2.id}&date=${NEXT_MON}`, asP(s))).status, 404);
  assert.equal((await api('GET', '/api/patient/slots?doctorId=1&date=bad', asP(s))).status, 400);
});

let kabir, kabirBooking;

test('book: a patient books for someone on their own account, as the app', async () => {
  kabir = seedSession;
  const profile = kabir.profiles.find((p) => p.fullName === 'Md. Kabir Hossain');
  const r = await api('POST', '/api/patient/bookings', { ...asP(kabir), body: { doctorId: d1.id, date: NEXT_MON, time: '10:00', profileId: profile.id, reason: 'check-up' } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  kabirBooking = r.body;
  assert.equal(r.body.source, 'app');
  assert.equal(r.body.patientId, profile.id);
  const staff = (await api('GET', `/api/bookings?date=${NEXT_MON}&doctorId=${d1.id}`, { token: receptionToken })).body;
  assert.ok(staff.some((b) => b.id === kabirBooking.id && b.source === 'app'), 'the front desk sees it');
  const mine = (await api('GET', '/api/patient/bookings', asP(kabir))).body;
  assert.ok(mine.some((b) => b.booking.id === kabirBooking.id && b.canCancel === true));
});

test('book: the same rules as the desk apply (taken slots, other people\'s profiles, bad times)', async () => {
  const other = await signIn();
  const mine = (await api('POST', '/api/patient/profiles', { ...asP(other), body: { fullName: 'Other Person', age: 40, gender: 'Male' } })).body.profiles[0];
  const book = (time, profileId = mine.id, extra = {}) => api('POST', '/api/patient/bookings', { ...asP(other), body: { doctorId: d1.id, date: NEXT_MON, time, profileId, ...extra } });
  assert.equal((await book('10:00')).status, 409, 'Kabir already holds 10:00');
  assert.equal((await book('10:03')).status, 400);
  assert.equal((await book('10:20', kabir.profiles[0].id)).status, 403, 'someone else\'s family member');
  assert.equal((await api('POST', '/api/patient/bookings', { ...asP(other), body: { doctorId: d2.id, date: NEXT_MON, time: '10:00', profileId: mine.id } })).status, 400, 'a doctor who does not take online bookings');
  assert.equal((await book('10:20', mine.id, { channel: 'carrier-pigeon' })).status, 400);
  assert.equal((await api('POST', '/api/patient/bookings', { ...asP(other), body: { doctorId: d1.id, date: NEXT_MON, time: '10:20' } })).status, 400, 'who is it for?');
  assert.equal((await book('10:20')).status, 200);
  assert.equal((await book('10:40')).status, 409, 'one booking per person per doctor per day');
});

test('book: six people at once for one slot give exactly one winner', async () => {
  const people = await Promise.all(Array.from({ length: 6 }, () => signIn()));
  const profiles = await Promise.all(people.map(async (p) => (await api('POST', '/api/patient/profiles', { ...asP(p), body: { fullName: 'Racer', age: 20, gender: 'Female' } })).body.profiles[0]));
  const results = await Promise.all(people.map((p, i) => api('POST', '/api/patient/bookings', { ...asP(p), body: { doctorId: d1.id, date: NEXT_MON, time: '11:40', profileId: profiles[i].id } })));
  assert.equal(results.filter((r) => r.status === 200).length, 1, results.map((r) => r.status).join());
  assert.equal(results.filter((r) => r.status === 409).length, 5);
});

test('book: an account may hold only five upcoming appointments', async () => {
  const s = await signIn();
  const ids = [];
  for (let i = 0; i < 6; i++) ids.push((await api('POST', '/api/patient/profiles', { ...asP(s), body: { fullName: `Member ${i}`, age: 20 + i, gender: 'Male' } })).body.profiles.at(-1).id);
  const times = ['10:40', '11:00', '11:20', '10:00', '10:20', '11:40'];
  const free = [];
  for (const t of times) {
    const day = (await api('GET', `/api/patient/slots?doctorId=${d1.id}&date=2026-11-16`, asP(s))).body;
    if (day.slots.some((x) => x.time === t)) free.push(t);
  }
  const results = [];
  for (let i = 0; i < 6; i++) results.push(await api('POST', '/api/patient/bookings', { ...asP(s), body: { doctorId: d1.id, date: '2026-11-16', time: free[i], profileId: ids[i] } }));
  assert.deepEqual(results.map((r) => r.status), [200, 200, 200, 200, 200, 400]);
  assert.match(results[5].body.errors[0], /already have 5 upcoming/);
});

test('cancel: far enough ahead works, only your own, and only once', async () => {
  const stranger = await signIn();
  assert.equal((await api('POST', `/api/patient/bookings/${kabirBooking.id}/cancel`, asP(stranger))).status, 404, 'someone else\'s booking looks like it does not exist');
  const own = await api('POST', `/api/patient/bookings/${kabirBooking.id}/cancel`, asP(kabir));
  assert.equal(own.status, 200, JSON.stringify(own.body));
  assert.equal(own.body.status, 'cancelled');
  assert.equal(own.body.cancelReason, 'Cancelled by the patient');
  assert.equal((await api('POST', `/api/patient/bookings/${kabirBooking.id}/cancel`, asP(kabir))).status, 409);
  const day = (await api('GET', `/api/patient/slots?doctorId=${d1.id}&date=${NEXT_MON}`, asP(stranger))).body;
  assert.ok(day.slots.some((x) => x.time === '10:00'), 'the time is free again');
});

test('cancel: too close to the appointment, the patient is told to call', async () => {
  const s = kabir;
  const profile = s.profiles[0];
  const b = await api('POST', '/api/patient/bookings', { ...asP(s), body: { doctorId: d1.id, date: TODAY, time: '11:20', profileId: profile.id } });
  assert.equal(b.status, 200, JSON.stringify(b.body));
  const list = (await api('GET', '/api/patient/bookings', asP(s))).body;
  assert.equal(list.find((x) => x.booking.id === b.body.id).canCancel, false, 'it is 80 minutes away and the rule is 2 hours');
  const r = await api('POST', `/api/patient/bookings/${b.body.id}/cancel`, asP(s));
  assert.equal(r.status, 400);
  assert.match(r.body.errors[0], /call the clinic/);
});

test('queue: once checked in, the patient sees their place in line, with counts only', async () => {
  const s = kabir;
  const mine = (await api('GET', '/api/patient/bookings', asP(s))).body.find((x) => x.booking.date === TODAY && x.booking.status === 'booked');
  const q0 = await api('GET', '/api/patient/queue', asP(s));
  assert.equal(q0.status, 200, q0.text);
  assert.equal(q0.body.length, 0, 'nothing until they arrive');
  const arrive = await api('POST', `/api/bookings/${mine.booking.id}/arrive`, { token: receptionToken });
  assert.equal(arrive.status, 200, JSON.stringify(arrive.body));
  const q = (await api('GET', '/api/patient/queue', asP(s))).body;
  assert.equal(q.length, 1);
  assert.equal(q[0].token, arrive.body.tokenNumber);
  assert.equal(q[0].nowServing, 1, 'the seed has token 1 in the chamber');
  assert.equal(q[0].ahead, 2, 'tokens 2 and 3 are still waiting ahead');
  assert.ok(!('estimatedWait' in q[0]), 'no wait time is promised because none is measured');
});

test('isolation: a patient never sees another account\'s bookings', async () => {
  const stranger = await signIn();
  assert.deepEqual((await api('GET', '/api/patient/bookings', asP(stranger))).body, []);
  assert.deepEqual((await api('GET', '/api/patient/queue', asP(stranger))).body, []);
});

// =============================================================================
// SMS delivery
// =============================================================================

test('sms gateway: the http provider sends the code to the configured gateway, with its key', async () => {
  const received = [];
  let status = 200;
  const gateway = createServer((req, res) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      received.push({ headers: req.headers, body: data });
      res.statusCode = status;
      res.end('{}');
    });
  }).listen(MOCK_PORT);
  const key = `gw-${randomBytes(6).toString('hex')}`;
  try {
    await startApi({ dbName: stack.dbName, port: 5162, env: {
      Sms__Provider: 'http', Patient__CodesPerIpPer10Min: '1000', Sms__Url: `http://localhost:${MOCK_PORT}/send`, Sms__AuthHeaderName: 'X-Api-Key', Sms__AuthHeaderValue: key,
      Sms__Body: '{"to":"{to}","text":"{message}"}',
    } });
    const phone = newPhone();
    const r = await call(GATEWAY_API, 'POST', '/api/patient/auth/request-code', { body: { phone } });
    assert.equal(r.status, 200);
    assert.ok(!/\b\d{6}\b/.test(r.text), 'the API reply never carries the code');
    assert.equal(received.length, 1);
    assert.equal(received[0].headers['x-api-key'], key, 'the gateway key is sent');
    const sms = JSON.parse(received[0].body);
    assert.equal(sms.to, norm(phone));
    const code = sms.text.match(/\b(\d{6})\b/)[1];
    seenCodes.push(code);
    const v = await call(GATEWAY_API, 'POST', '/api/patient/auth/verify', { body: { phone, code } });
    assert.equal(v.status, 200, 'a code that travelled through the gateway signs the patient in');

    // gateway answers with an error: the patient is told, and the unsent code is not left valid
    status = 500;
    const failPhone = newPhone();
    const failed = await call(GATEWAY_API, 'POST', '/api/patient/auth/request-code', { body: { phone: failPhone } });
    assert.equal(failed.status, 503);
    assert.match(failed.body.errors[0], /couldn't send the code/);
    const leaked = JSON.parse(received.at(-1).body).text.match(/\b(\d{6})\b/)[1];
    assert.equal((await call(GATEWAY_API, 'POST', '/api/patient/auth/verify', { body: { phone: failPhone, code: leaked } })).status, 401, 'a code that was never delivered cannot be used');
  } finally {
    gateway.close();
  }
  // gateway not running at all
  const down = await call(GATEWAY_API, 'POST', '/api/patient/auth/request-code', { body: { phone: newPhone() } });
  assert.equal(down.status, 503);
});

test('sms default: the development log provider exposes no test route and no code in replies', async () => {
  await startApi({ dbName: stack.dbName, port: 5163, env: { Patient__CodesPerIpPer10Min: '1000' } });
  const r = await call(LOGMODE, 'POST', '/api/patient/auth/request-code', { body: { phone: newPhone() } });
  assert.equal(r.status, 200);
  assert.ok(!/\b\d{6}\b/.test(r.text));
  assert.equal((await call(LOGMODE, 'GET', '/api/_test/sms?phone=%2B8801700000000')).status, 404, 'the test-only route does not exist outside test mode');
});

test('patient sign-in works whether or not staff sign-in is enforced', async () => {
  await startApi({ dbName: stack.dbName, port: 5164, env: { Auth__Enforce: 'false', Sms__Provider: 'test', Patient__CodesPerIpPer10Min: '1000' } });
  const s = await signIn(newPhone(), OFF);
  assert.equal((await call(OFF, 'GET', '/api/patient/me', { token: s.token })).status, 200);
  assert.equal((await call(OFF, 'GET', '/api/patient/me')).status, 401, 'patient routes always need a patient token');
});

// =============================================================================
// The log
// =============================================================================

test('audit: sign-ins are logged with a masked number, and neither a full number nor a code is ever stored', async () => {
  const events = await api('GET', '/api/auth/events', { token: managerToken });
  assert.equal(events.status, 200);
  const names = new Set(events.body.map((e) => e.event));
  for (const expected of ['patient_code_sent', 'patient_login', 'patient_code_wrong', 'patient_code_limited']) assert.ok(names.has(expected), `missing ${expected}`);
  assert.ok(!/\+8801\d{9}/.test(events.text), 'no full phone number in the log');
  assert.match(events.text, /\+880\*{6}\d{3}/, 'a masked number is');
  for (const code of new Set(seenCodes)) assert.ok(!events.text.includes(`"${code}"`) && !events.text.includes(`code is ${code}`), 'a code appears in the log');
});

test('code: one address cannot ask for codes for endless numbers', async () => {
  await stopStack();
  stack = await startStack({ port: 5165, env: { Sms__Provider: 'test', Patient__CodesPerIpPer10Min: '3' } });
  const out = [];
  for (let i = 0; i < 4; i++) out.push((await call('http://localhost:5165', 'POST', '/api/patient/auth/request-code', { body: { phone: newPhone() } })).status);
  assert.deepEqual(out, [200, 200, 200, 429]);
});
