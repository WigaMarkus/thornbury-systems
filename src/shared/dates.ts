// Date helpers shared by billing and scheduling.
//
// Everything the customer sees is UK local time. Everything we store is UTC.
// The two are not the same thing for half the year and this file is where that
// keeps going wrong.
//
// The rule for anything customer facing: convert to UK local explicitly, with
// the helpers below. Never use getHours/getDate/getDay for it. Those read the
// timezone of whatever machine the process happens to be on, which is UK local
// only by luck, and is right all winter even when the code is wrong. That is
// what made W-4412 look like it could not be reproduced.

export const UK_TIME_ZONE = 'Europe/London';

export const BANK_HOLIDAYS_2026 = [
  '2026-01-01', '2026-04-03', '2026-04-06', '2026-05-04',
  '2026-05-25', '2026-08-31', '2026-12-25', '2026-12-28',
];

// hourCycle h23 rather than hour12 false: some ICU builds render midnight as
// 24:00 for the latter.
const ukFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: UK_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

interface UkParts {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
}

// The instant, broken into the calendar fields a UK customer would read off a
// clock and a wall calendar. Handles BST and GMT, whatever the host timezone is.
function ukParts(d: Date): UkParts {
  const out: Record<string, string> = {};
  for (const part of ukFormatter.formatToParts(d)) {
    if (part.type !== 'literal') out[part.type] = part.value;
  }
  return out as unknown as UkParts;
}

// The UK local calendar date, as YYYY-MM-DD. This is the date to put in front of
// a customer. It is not always the same date as the stored UTC timestamp: an
// appointment at 23:30Z in the summer is half past midnight the next day here.
export function ukDateKey(d: Date): string {
  const { year, month, day } = ukParts(d);
  return `${year}-${month}-${day}`;
}

// The UTC calendar date. Internal bookkeeping only, never shown to a customer.
// The bank holiday list is on this, so those are UTC days.
export function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// NOTE (W-4412): getDay below is host local while toDateKey is UTC, so this
// function mixes two calendars and can disagree with itself within an hour of
// midnight. It is wrong in the same family of ways as the slot bug was. Left
// alone deliberately: dispatch and billing both depend on the current
// behaviour, and correcting it is a change to their tickets, not this one.
export function isWorkingDay(d: Date): boolean {
  const day = d.getDay();
  if (day === 0 || day === 6) return false;
  return !BANK_HOLIDAYS_2026.includes(toDateKey(d));
}

export function addWorkingDays(from: Date, n: number): Date {
  const d = new Date(from.getTime());
  let left = n;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (isWorkingDay(d)) left--;
  }
  return d;
}

// What the customer is told their appointment time is. UK local.
export function formatSlotTime(d: Date): string {
  const { hour, minute } = ukParts(d);
  return `${hour}:${minute}`;
}

// Whether two instants fall on the same day as the customer would count days.
// This is the UK day, not the UTC day: an out of hours visit at 23:30Z in the
// summer is the next day for everyone involved, including the engineer. The UTC
// version of this silently treated a late job as a repeat of the previous day's
// visit and dropped it from the plan. See jobs/JOB-D-timezone.md.
export function sameUkDay(a: Date, b: Date): boolean {
  return ukDateKey(a) === ukDateKey(b);
}
