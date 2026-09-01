// Money: pence -> sterling. Server sends pre-formatted display strings which we
// use verbatim; formatPence exists ONLY for client-computed values (line totals,
// dashboard outstanding sum).
const gbp = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
});

export function formatPence(pence: number): string {
  return gbp.format(pence / 100);
}

// Dates are stored UTC and ALWAYS shown UK-local (Europe/London), regardless of
// the host machine's timezone (W-4412: host-local rendering is a known bug).
const ukDateFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const ukTimeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const ukDateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function ukDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : ukDateFmt.format(d);
}

export function ukTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : ukTimeFmt.format(d);
}

export function ukDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : ukDateTimeFmt.format(d);
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// Plain YYYY-MM-DD strings are calendar dates, not instants: reformat by string
// split, NEVER via new Date() (which would shift across timezones).
export function ymdToDisplay(ymd: string): string {
  if (!ymd) return '';
  const parts = ymd.split('-');
  if (parts.length !== 3) return ymd;
  const [y, m, d] = parts;
  const monthIdx = Number(m) - 1;
  const month = MONTHS[monthIdx];
  if (!month) return ymd;
  return `${Number(d)} ${month} ${y}`;
}
