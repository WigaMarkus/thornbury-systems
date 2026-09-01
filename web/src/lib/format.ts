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

// Convert a <input type="datetime-local"> value ('YYYY-MM-DDTHH:mm'), meant as
// a Europe/London wall-clock time, into a UTC ISO instant — independent of the
// host machine's timezone. Two-pass correction: render a UTC candidate through
// the UK formatter, add the wall-clock difference, repeat once (the second pass
// settles DST boundaries). Returns null when the input is unparseable.
export function ukWallClockToIso(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const typed = Date.UTC(y, mo - 1, d, h, mi);
  if (Number.isNaN(typed)) return null;
  let candidate = typed;
  for (let pass = 0; pass < 2; pass++) {
    const p = ukParts(new Date(candidate));
    const rendered = Date.UTC(
      Number(p.year),
      Number(p.month) - 1,
      Number(p.day),
      Number(p.hour) % 24,
      Number(p.minute),
    );
    const diff = typed - rendered;
    if (diff === 0) break;
    candidate += diff;
  }
  const result = new Date(candidate);
  if (Number.isNaN(result.getTime())) return null;
  return result.toISOString();
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
