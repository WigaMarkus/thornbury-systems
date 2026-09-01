import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../src/scheduling/dispatch.ts';
import { normaliseAddress } from '../src/scheduling/address.ts';
import { workOrders, type WorkOrder } from '../src/db.ts';

function order(over: Partial<WorkOrder> & { id: string; address: string }): WorkOrder {
  return {
    customerId: 'C-1001',
    requires: 'LEAK',
    requestedAt: '2026-09-02T09:00:00Z',
    durationMinutes: 60,
    status: 'QUEUED',
    ...over,
  };
}

// JOB B. Mrs Whitcombe had the meter job and the leak job on the same morning,
// half an hour apart, because the two orders spell her address differently.
test('the same house typed two ways only gets one van', () => {
  const plan = dispatch(workOrders);
  const ashfield = plan.filter((a) => normaliseAddress(a.address) === '14 ashfield row bristol');
  assert.equal(ashfield.length, 1);
  assert.equal(ashfield[0].workOrderId, 'W-5001');
});

test('casing, punctuation and spacing do not make it a different house', () => {
  const plan = dispatch([
    order({ id: 'W-1', address: '2 Bell Lane, Thornbury', requires: 'METER' }),
    order({ id: 'W-2', address: '2  bell lane thornbury.', requestedAt: '2026-09-02T09:30:00Z' }),
  ]);

  assert.deepEqual(plan.map((a) => a.workOrderId), ['W-1']);
});

test('two different houses on the same day both get a van', () => {
  const plan = dispatch([
    order({ id: 'W-1', address: '14 Ashfield Row, Bristol' }),
    order({ id: 'W-2', address: '16 Ashfield Row, Bristol', requestedAt: '2026-09-02T11:00:00Z' }),
  ]);

  assert.deepEqual(plan.map((a) => a.workOrderId), ['W-1', 'W-2']);
});

test('the same house on two days gets a van on each', () => {
  const plan = dispatch([
    order({ id: 'W-1', address: '14 Ashfield Row, Bristol' }),
    order({ id: 'W-2', address: '14 ashfield row, bristol', requestedAt: '2026-09-03T09:00:00Z' }),
  ]);

  assert.deepEqual(plan.map((a) => a.workOrderId), ['W-1', 'W-2']);
});

test('addresses are normalised, not rewritten', () => {
  assert.equal(normaliseAddress('  14 Ashfield Row,  Bristol '), '14 ashfield row bristol');
  assert.equal(normaliseAddress('Unit 6, Severnside Park, Avonmouth'), 'unit 6 severnside park avonmouth');
  // Two houses on the same street stay two houses.
  assert.notEqual(normaliseAddress('14 Ashfield Row'), normaliseAddress('16 Ashfield Row'));
  // We do not guess that Rd and Road are the same word.
  assert.notEqual(normaliseAddress('Gloucester Rd'), normaliseAddress('Gloucester Road'));
});

test('the plan keeps the address as it was typed', () => {
  const plan = dispatch([order({ id: 'W-1', address: '14 Ashfield Row, Bristol' })]);
  assert.equal(plan[0].address, '14 Ashfield Row, Bristol');
});
