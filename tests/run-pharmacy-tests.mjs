#!/usr/bin/env node
/**
 * Pharmacy hand-over records and prescription history, against a throw-away database and API.
 *
 *   node tests/run-pharmacy-tests.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { startStack, stopStack } from './lib/test-stack.mjs';

let stack;
const call = async (method, path, body) => {
  const res = await fetch(`${stack.base}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, data: await res.json().catch(() => null) };
};

test.before(async () => {
  stack = await startStack({ port: 5156 });
});
test.after(async () => {
  await stopStack();
});

const rxBody = (doctorId, patientId, brand, diagnosis) => ({
  doctorId, patientId, chiefComplaints: ['Fever'], diagnosis, adviceBangla: ['Rest'],
  items: [{ brandName: brand, genericName: 'Paracetamol', form: 'Tablet', strength: '500mg', dosagePattern: '1+0+1', duration: '5 days', instructionsBangla: 'after meals' }],
  investigations: [],
});

test('a revised prescription keeps what the earlier version said, and hand-overs stay on record', async () => {
  const doctors = (await call('GET', '/api/doctors')).data;
  const patients = (await call('GET', '/api/patients')).data;
  const created = await call('POST', '/api/prescriptions', rxBody(doctors[0].id, patients[0].id, 'Napa', 'Viral fever'));
  assert.equal(created.status, 200, JSON.stringify(created.data));
  const id = created.data.prescriptionId;

  // pharmacist hands over under version 1, twice (idempotent), then a wrong brand is refused
  let r = await call('POST', `/api/pharmacy/prescriptions/${id}/dispense`, { items: [{ brandName: 'Napa' }], note: 'full strip' });
  assert.equal(r.status, 200);
  assert.equal(r.data.recorded, 1);
  r = await call('POST', `/api/pharmacy/prescriptions/${id}/dispense`, { items: [{ brandName: 'Napa' }] });
  assert.equal(r.data.recorded, 0);
  assert.equal((await call('POST', `/api/pharmacy/prescriptions/${id}/dispense`, { items: [{ brandName: 'Other' }] })).status, 400);
  assert.equal((await call('POST', `/api/pharmacy/prescriptions/${id}/dispense`, { items: [] })).status, 400);

  let detail = (await call('GET', `/api/pharmacy/prescriptions/${id}`)).data;
  assert.equal(detail.dispensed.length, 1);
  assert.equal(detail.revisedAfterDispense, false);
  assert.equal((await call('GET', '/api/pharmacy/prescriptions')).data.find((x) => x.id === id).dispensed_count, 1);

  // the doctor changes the prescription: version 2, and the pharmacy is told it changed after hand-over
  const revised = await call('PUT', `/api/prescriptions/${id}`, rxBody(doctors[0].id, patients[0].id, 'Ace', 'Viral fever with cough'));
  assert.equal(revised.status, 200, JSON.stringify(revised.data));
  detail = (await call('GET', `/api/pharmacy/prescriptions/${id}`)).data;
  assert.equal(detail.revisedAfterDispense, true);
  assert.equal(detail.dispensed[0].brandName, 'Napa');
  assert.equal(detail.dispensed[0].prescriptionVersion, 1);
  assert.equal((await call('GET', '/api/pharmacy/prescriptions')).data.find((x) => x.id === id).dispensed_count, 0, 'nothing is handed over yet for version 2');

  // history shows version 1 as it was
  const h = (await call('GET', `/api/prescriptions/${id}/history`)).data;
  assert.equal(h.currentVersion, 2);
  assert.equal(h.earlier.length, 1);
  assert.equal(h.earlier[0].version, 1);
  assert.equal(h.earlier[0].diagnosis, 'Viral fever');
  assert.equal(h.earlier[0].medicines[0].brandName, 'Napa');
  assert.equal(h.earlier[0].medicines[0].dosagePattern, '1+0+1');

  // an undo works inside 15 minutes; a record that does not exist is a 409
  assert.equal((await call('DELETE', `/api/pharmacy/dispense/${detail.dispensed[0].id}`)).status, 200);
  assert.equal((await call('DELETE', '/api/pharmacy/dispense/99999999')).status, 409);
  assert.equal((await call('GET', '/api/prescriptions/99999999/history')).status, 404);
});
