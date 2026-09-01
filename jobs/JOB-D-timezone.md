# JOB D: a customer was given the wrong day

**Raised by:** Support (Marcus, 26 Aug)
**Queue age:** 2 days

Trelawney have a late backflow test booked and the confirmation we sent them has
the wrong date on it. Marcus checked the work order and the stored time is right,
so it is what we print that is wrong.

He says this is the same thing as W-4412, which has been closed twice as cannot
reproduce. Both reports came in the summer. Nobody has managed to make it happen
in the winter, and it has never once failed on the build box.

Everything the customer sees is UK local. Everything we store is UTC. Somewhere
those two are being treated as the same thing.

---

## Resolved (W-4412, third report)

**Reproduced** with the out of hours order W-5006 (`2026-09-02T23:30:00Z`). We printed
`2026-09-02`; the customer's date is `2026-09-03`, because 23:30 UTC is 00:30 the next
day in BST.

**Cause.** Two places built customer facing values without converting UTC to UK local:

- `formatSlotTime` used `getHours()`, which reads the *host machine's* timezone.
- `slotFor` took the date with `requestedAt.slice(0, 10)`, i.e. the stored UTC date.

**Why it was closed twice.** Both are correct by accident in winter, when UK local is
UTC. In summer they are wrong, which matches both reports arriving in the summer. It
stayed green because everyone who looked was on a machine set to UK time, where the
window comes out right and only the *date* of a late job is wrong, and there was no
late job in the seed data until Marcus flagged one on 26 Aug. The test added in
May 2024 hardcoded BST values, so it passed on a UK machine and failed on any other
one; that is a test of the developer's timezone, not of the code.

**Fix.** `src/shared/dates.ts` now converts explicitly via `Intl` with
`timeZone: 'Europe/London'` (`ukDateKey`, `formatSlotTime`). Regression tests pass
under the host timezone and under `TZ=UTC`, and fail if either bug is reintroduced.

**Second half, found while merging.** JOB B's duplicate visit check compared the
*UTC* day. Trelawney's 23:30Z backflow test therefore counted as the same day as
their 09:00Z one and was dropped from the dispatch plan: the customer would have had
a confirmation and no engineer. JOB B's note handed the shared date split to JOB D and
this file handed the day comparison back to JOB B, so it would have fallen between the
two tickets. The whole suite was green while it was broken. `sameDay` is now
`sameUkDay` and compares UK days; the genuine duplicate (W-5002, Mrs Whitcombe) is
still caught. Committed separately so it can be reverted on its own.

**Open points, not decided here:**

1. A padded window on a just-after-midnight job opens the evening before, so W-5006
   reads "23:30 to 02:15" on 3 September. Correct, but odd to read. Marcus to say what
   a confirmation should print.
2. `isWorkingDay` still mixes calendars: `getDay()` is host local, the bank holiday
   list is UTC. Same family of bug. Nothing customer facing reads it today, so it is
   left alone and flagged in the code; it needs an owner before anything starts
   quoting working days to customers.
3. The build box is set to UK time. That is why it never caught this. It should run
   the suite under at least one non-UK timezone.
