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

// One month style for the whole app, shared by the Intl path (instants) and the
// string-split path (plain calendar dates), so "1 Sept 2026" never sits next to
// "01 Sep 2026" in the same table.
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'June',
  'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec',
];

// Dates are stored UTC and ALWAYS shown UK-local (Europe/London), regardless of
// the host machine's timezone (W-4412: host-local rendering is a known bug).
const ukPartsFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function ukParts(d: Date): Record<string, string> {
  return Object.fromEntries(
    ukPartsFmt.formatToParts(d).map((p) => [p.type, p.value]),
  );
}

export function ukDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = ukParts(d);
  return `${Number(p.day)} ${MONTHS[Number(p.month) - 1]} ${p.year}`;
}

export function ukTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = ukParts(d);
  return `${p.hour}:${p.minute}`;
}

export function ukDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${ukDate(iso)}, ${ukTime(iso)}`;
}

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
