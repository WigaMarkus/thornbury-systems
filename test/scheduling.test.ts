import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slotFor } from '../src/scheduling/slots.ts';
import { dispatch } from '../src/scheduling/dispatch.ts';
import { workOrders } from '../src/db.ts';

test('a customer is quoted a window around the requested time', () => {
  const order = workOrders.find((w) => w.id === 'W-5001')!;
  const slot = slotFor(order);
  assert.equal(slot.window, '08:00 to 11:00');
  assert.equal(slot.date, '2026-09-02');
});

test('dispatch only plans queued work', () => {
  const plan = dispatch(workOrders.map((w) => ({ ...w, status: 'DONE' as const })));
  assert.equal(plan.length, 0);
});

test('dispatch matches the required skill', () => {
  const plan = dispatch(workOrders);
  const backflow = plan.find((a) => a.workOrderId === 'W-5003');
  assert.equal(backflow?.engineerId, 'E-02');
});

// W-4412 / JOB D. These assert exact UK local strings on purpose. They passed
// before the fix only on a machine set to UK time, which is why the bug was
// closed twice as cannot reproduce. They must now hold on any host timezone;
// run the suite under TZ=UTC as well as locally before believing them.
test('a late appointment is quoted on the UK date, not the stored UTC date', () => {
  // 23:30Z in BST is 00:30 the following day for the customer.
  const order = workOrders.find((w) => w.id === 'W-5006')!;
  const slot = slotFor(order);
  assert.equal(slot.date, '2026-09-03');
  assert.equal(slot.window, '23:30 to 02:15');
});

test('the window is UK local in summer, so an hour ahead of the stored time', () => {
  const order = { ...workOrders[0], requestedAt: '2026-06-15T08:00:00Z', durationMinutes: 60 };
  assert.equal(slotFor(order).window, '08:00 to 11:00');
  assert.equal(slotFor(order).date, '2026-06-15');
});

test('the window is unchanged in winter, when UK local is UTC', () => {
  const order = { ...workOrders[0], requestedAt: '2026-01-15T08:00:00Z', durationMinutes: 60 };
  assert.equal(slotFor(order).window, '07:00 to 10:00');
  assert.equal(slotFor(order).date, '2026-01-15');
});

test('a late appointment in winter stays on the stored date', () => {
  // The mirror of the BST case: in GMT there is no shift, so no day rollover.
  const order = { ...workOrders[0], requestedAt: '2026-01-15T23:30:00Z', durationMinutes: 45 };
  assert.equal(slotFor(order).date, '2026-01-15');
  assert.equal(slotFor(order).window, '22:30 to 01:15');
});
