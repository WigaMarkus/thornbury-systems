# Thornbury Systems

Billing and job scheduling for UK water utilities. This repository is the API,
the web front end, and the database. The desktop product is not in here.

## Running it

The API has no install step. Node 22.6 or newer runs the TypeScript directly.

```
npm test        # the suite (80 tests)
npm start       # API + built front end on http://localhost:4310
```

The front end ships pre-built in `web/dist` after `npm run build` there. To work
on it:

```
cd web
npm install
npm run dev     # Vite on :5173, proxying API calls to :4310 (run npm start too)
npm run build   # emits web/dist, which npm start serves
```

The same URLs serve both audiences: a browser gets the app, curl and the test
suite get JSON (content negotiation on the Accept header).

Data lives in `data/thornbury.db` (SQLite via node:sqlite, no dependencies),
created and seeded from `src/db.ts` on first start. Delete the `data/` folder
for a factory-fresh demo state.

## Layout

- `src/invoices` billing. Totals, VAT, balances, statements.
- `src/scheduling` work orders, engineer dispatch, customer appointment windows.
- `src/shared` money and dates. Both are used by both sides, so changes here reach further than they look.
- `src/db.ts` the seed data, and the source of truth for the entity types. Seeds the SQLite database on first boot.
- `src/repo.ts` the SQLite layer. Tests get an isolated in-memory database per process automatically.
- `web/` the React front end. Money arrives pre-formatted from the API; every timestamp renders Europe/London.
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
