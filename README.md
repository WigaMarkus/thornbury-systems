# Thornbury Systems

Billing and job scheduling for UK water utilities. This repository is the API the
web front end talks to. The desktop product is not in here.

## Running it

No install step. Node 22.6 or newer runs the TypeScript directly.

```
npm test        # the suite
npm start       # http://localhost:4310
```

## Layout

- `src/invoices` billing. Totals, VAT, balances, statements.
- `src/scheduling` work orders, engineer dispatch, customer appointment windows.
- `src/shared` money and dates. Both are used by both sides, so changes here reach further than they look.
- `src/db.ts` the seed data. Stands in for the SQL Server tables.
- `jobs/` the support queue. The four that were open are done; JOB D carries its
  write up in the ticket.
- `docs/` the decisions behind the billing rules. `vat.md` for what is rated how and
  what Finance has still to confirm, `statements.md` for what goes on a statement.

## Notes from the team

The migration off the desktop product stalled in 2023. What you are looking at is
the half that got done.

Priya wrote most of the scheduling side and left in March. Nobody has picked it up.
If something in there looks deliberate, it probably was, but the reasoning is not
written down anywhere.

Money is in pence. Dates are stored UTC and shown UK local. Those two rules are the
only ones everybody agreed on.

There is no CLAUDE.md and no contributor guide. That was on Priya's list.

The build box runs UK time, which is why W-4412 sat open for two years: the date bugs
are only wrong between March and October. Run the suite under a second timezone
(`TZ=UTC npm test`) before believing it.
