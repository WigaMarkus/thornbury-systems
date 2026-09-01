import { formatSlotTime, ukDateKey } from '../shared/dates.ts';
import type { WorkOrder } from '../db.ts';

export interface Slot {
  workOrderId: string;
  // What we tell the customer. UK local time.
  window: string;
  // The UK local date of the appointment. UK local, not the stored UTC date.
  date: string;
}

// W-4412: two customers said the window was an hour out. Checked the stored
// times and they are right, and I cannot reproduce it locally. Closing.
// W-4412 reopened Jul 25. Still green on my machine and on the build box.
// Closing again. If it comes back a third time somebody else can have it.
//
// W-4412 fixed on the third report (JOB D). It was never the padding. Both the
// window and the date were built without converting UTC to UK local: the window
// used the host machine's timezone and the date was sliced straight off the
// stored UTC string. In winter UK local is UTC, so both were right by accident.
// In summer the window was an hour out, and a late appointment was reported on
// the wrong day, because 23:30Z is 00:30 the next day in BST. It could not be
// reproduced because everyone who looked was on a machine set to UK time, where
// the window is right and only the date of a late job is wrong, and there was no
// late job in the seed data until Marcus flagged one.
const WINDOW_PADDING_MINUTES = 60;

// The customer is given a window, not a time: the requested time, minus an hour,
// through the requested time plus the job length plus an hour.
export function slotFor(order: WorkOrder): Slot {
  const start = new Date(order.requestedAt);
  const from = new Date(start.getTime() - WINDOW_PADDING_MINUTES * 60_000);
  const to = new Date(
    start.getTime() + (order.durationMinutes + WINDOW_PADDING_MINUTES) * 60_000,
  );

  return {
    workOrderId: order.id,
    window: `${formatSlotTime(from)} to ${formatSlotTime(to)}`,
    // The appointment's own UK date, not the window's start. For a job just
    // after midnight the padded window opens the evening before, so these are
    // not always the same day. Open question for Marcus: what a confirmation
    // should say in that case. See jobs/JOB-D-timezone.md.
    date: ukDateKey(start),
  };
}

export function slotsFor(orders: WorkOrder[]): Slot[] {
  return orders.map(slotFor);
}
