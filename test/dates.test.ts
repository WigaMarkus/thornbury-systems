import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isWorkingDay, addWorkingDays, toDateKey, ukDateKey, formatSlotTime } from '../src/shared/dates.ts';

test('weekends are not working days', () => {
  assert.equal(isWorkingDay(new Date('2026-09-05T12:00:00Z')), false);
  assert.equal(isWorkingDay(new Date('2026-09-06T12:00:00Z')), false);
});

test('bank holidays are not working days', () => {
  assert.equal(isWorkingDay(new Date('2026-12-25T12:00:00Z')), false);
});

test('adding working days skips the weekend', () => {
  const friday = new Date('2026-09-04T12:00:00Z');
  assert.equal(toDateKey(addWorkingDays(friday, 1)), '2026-09-07');
});

// W-4412 / JOB D. The customer facing date key must be UK local, and must not
// move if the host timezone changes.
test('the UK date key rolls over at UK midnight, not UTC midnight', () => {
  // BST: 23:00Z is already the next day for the customer.
  assert.equal(ukDateKey(new Date('2026-09-02T23:00:00Z')), '2026-09-03');
  assert.equal(ukDateKey(new Date('2026-09-02T22:59:00Z')), '2026-09-02');
  // GMT: no offset, so the UTC date and the UK date agree.
  assert.equal(ukDateKey(new Date('2026-01-02T23:00:00Z')), '2026-01-02');
});

test('the slot time is UK local, not host local', () => {
  assert.equal(formatSlotTime(new Date('2026-06-15T08:00:00Z')), '09:00'); // BST
  assert.equal(formatSlotTime(new Date('2026-01-15T08:00:00Z')), '08:00'); // GMT
  assert.equal(formatSlotTime(new Date('2026-09-02T23:30:00Z')), '00:30'); // past midnight
});
