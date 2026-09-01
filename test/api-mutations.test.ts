import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { server } from '../src/server.ts';

// Write paths: recording payments, raising work orders, running the dispatcher.
// This file has its own process and therefore its own in-memory database, so it
// can mutate freely. Tests run in order and each builds on the state the
// previous one left behind.

let base = '';

before(async () => {
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('no port');
  base = `http://127.0.0.1:${address.port}`;
});

after(() => new Promise<void>((resolve) => server.close(() => resolve())));

const post = (path: string, body?: unknown) =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

test('paying an invoice with no body settles it in full, today', async () => {
  const res = await post('/invoices/INV-9002/payments');
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(typeof body.payment.amountPence, 'number');
  assert.equal(body.invoice.paid, true);

  const invoice = await (await fetch(`${base}/invoices/INV-9002`)).json();
  assert.equal(invoice.paid, true);
  assert.match(invoice.paidOn, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(invoice.payments.length, 1);
  assert.equal(invoice.outstandingPence, 0);

  const customer = await (await fetch(`${base}/customers/C-1002`)).json();
  assert.equal(customer.outstanding, '£0.00');
});

test('paying an already settled invoice is a 409', async () => {
  const res = await post('/invoices/INV-9002/payments');
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.error, 'invoice already paid');
  assert.ok(body.paidOn);
});

test('a valid work order is created as W-5007 and queued', async () => {
  const res = await post('/work-orders', {
    customerId: 'C-1003',
    address: '2 Bell Lane, Thornbury',
    requires: 'LEAK',
    requestedAt: '2026-09-10T09:00:00Z',
    durationMinutes: 60,
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.workOrder.id, 'W-5007');
  assert.equal(body.workOrder.status, 'QUEUED');
  assert.deepEqual(body.warnings, []);

  const all = await (await fetch(`${base}/work-orders`)).json();
  assert.ok(all.some((w: { id: string }) => w.id === 'W-5007'));
});

test('a second visit to the same house on the same day is flagged, not blocked', async () => {
  const res = await post('/work-orders', {
    customerId: 'C-1001',
    address: '14 ASHFIELD ROW,, Bristol',
    requires: 'LEAK',
    requestedAt: '2026-09-02T10:00:00Z',
    durationMinutes: 45,
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.ok(body.warnings.includes('DUPLICATE_VISIT_SAME_DAY'));
});

test('a skill nobody has is flagged, not blocked', async () => {
  const res = await post('/work-orders', {
    customerId: 'C-1002',
    address: 'Unit 9, Severnside Park, Avonmouth',
    requires: 'gasleak',
    requestedAt: '2026-09-11T09:00:00Z',
    durationMinutes: 30,
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.workOrder.requires, 'GASLEAK');
  assert.ok(body.warnings.includes('NO_ENGINEER_WITH_SKILL'));
});

test('a work order for an unknown customer is refused', async () => {
  const res = await post('/work-orders', {
    customerId: 'C-9999',
    address: 'Nowhere Lane',
    requires: 'LEAK',
    requestedAt: '2026-09-10T09:00:00Z',
    durationMinutes: 60,
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.field, 'customerId');
});

let firstRunCount = 0;

test('running the dispatcher assigns engineers and reports what it skipped', async () => {
  const res = await post('/dispatch/run');
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.ok(body.assignments.length > 0);
  for (const a of body.assignments) {
    assert.equal(typeof a.engineerName, 'string');
    assert.ok(a.engineerName.length > 0);
  }
  assert.ok(
    body.unassigned.some(
      (u: { workOrderId: string; reason: string }) =>
        u.workOrderId === 'W-5002' && u.reason === 'DUPLICATE_VISIT',
    ),
  );
  assert.equal(body.dispatchedCount, body.assignments.length);
  firstRunCount = body.dispatchedCount;

  const all = await (await fetch(`${base}/work-orders`)).json();
  for (const a of body.assignments) {
    const order = all.find((w: { id: string }) => w.id === a.workOrderId);
    assert.equal(order.status, 'DISPATCHED');
    assert.equal(order.engineerId, a.engineerId);
  }
});

test('a second run only dispatches what is still queued', async () => {
  const res = await post('/dispatch/run');
  assert.equal(res.status, 200);
  const body = await res.json();

  // Everything dispatched last time is skipped now, so this run is smaller. A
  // duplicate suppressed on the first run (W-5002) may legitimately be
  // scheduled now that its clashing visit is out of the queue.
  assert.ok(body.dispatchedCount < firstRunCount);
  assert.equal(body.dispatchedCount, body.assignments.length);
});

test('reset puts every dispatched order back in the queue', async () => {
  const res = await post('/dispatch/reset');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.requeued > 0);

  const all = await (await fetch(`${base}/work-orders`)).json();
  assert.ok(all.every((w: { status: string }) => w.status !== 'DISPATCHED'));
});

test('a payment that does not settle the invoice in full is refused', async () => {
  const res = await post('/invoices/INV-9003/payments', { amountPence: 1 });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, 'amountPence must equal the outstanding total');
  assert.equal(typeof body.expectedPence, 'number');
  assert.equal(body.got, 1);
});

test('settling the same invoice twice records exactly one payment', async () => {
  const first = await post('/invoices/INV-9003/payments');
  assert.equal(first.status, 201);

  const second = await post('/invoices/INV-9003/payments');
  assert.equal(second.status, 409);
  const body = await second.json();
  assert.equal(body.error, 'invoice already paid');

  const invoice = await (await fetch(`${base}/invoices/INV-9003`)).json();
  assert.equal(invoice.paid, true);
  assert.equal(invoice.payments.length, 1);
});

test('requestedAt must be an explicit UTC instant', async () => {
  const order = (requestedAt: string) => ({
    customerId: 'C-1003',
    address: '7 Chantry Close, Thornbury',
    requires: 'LEAK',
    requestedAt,
    durationMinutes: 30,
  });

  // No Z suffix: parsed in the host's local zone downstream, so refused.
  const noZone = await post('/work-orders', order('2026-09-05T09:00'));
  assert.equal(noZone.status, 400);
  assert.equal((await noZone.json()).field, 'requestedAt');

  // Well-formed but not a real day.
  const badDate = await post('/work-orders', order('2026-02-30T09:00:00Z'));
  assert.equal(badDate.status, 400);
  assert.equal((await badDate.json()).field, 'requestedAt');

  const good = await post('/work-orders', order('2026-09-05T09:00:00Z'));
  assert.equal(good.status, 201);
});
