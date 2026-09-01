# JOB C: customers want a statement, not four invoices

**Raised by:** Trelawney Foods, via account management (5 Aug)
**Queue age:** 23 days

Their finance team asked for "a statement like our other suppliers send" because
they are reconciling four separate invoice PDFs by hand every quarter.

We do not have anything like this. The front end team say they can render whatever
we give them as long as it comes off an endpoint.

Nobody has agreed what goes on it.

---

## Resolved

**What was agreed.** Nobody had, so it is written down in `docs/statements.md` rather
than left in this ticket. `GET /customers/:id/statement?from=&to=` returns one document
per customer per period: who it is for, the period actually used, what was unpaid
before it started, a line per invoice, the net/VAT/gross for the period, and a single
closing balance. The front end renders it; the API decides nothing about layout.

**Built to survive the other three tickets.** The statement works out no money of its
own; every figure comes from `totalFor()`, and line rows spread the whole totals object
rather than picking fields off it. When JOB A landed, net, VAT and the rate bands
appeared on each line without `statement.ts` changing. It also constructs no `Date` at
all: invoice issue dates are compared as `YYYY-MM-DD` strings, so JOB D's UTC and UK
local split cannot reach in here.

**The merge with JOB A was clean and did not run.** No textual conflict, but `totalFor`
had gained a `customer` argument, so the old one argument call threw. The unit tests
were still green; only the route test caught it, and it *hung* rather than failed,
because a throw inside the request handler never ends the response. That is why there
is a `test/statement-route.test.ts` as well as `test/statements.test.ts`.

**Open points, not decided here:**

1. `Invoice.paid` is a boolean with no date, so this is an "as at today" snapshot and
   not a dated ledger. A statement for last quarter will not show the balance as it
   stood then, which is what most supplier statements do. Needs a payments table.
2. No default period. Asking for a statement with no bounds covers all history. If the
   product wants "the last quarter" by default, that is a decision and a clock
   dependency, and it should be made deliberately.
3. A throw in any route handler hangs the caller instead of returning 500. Left alone
   because wrapping the handler body reindents all of `src/server.ts`, which would have
   collided with three people editing it at once. Worth doing now that it is quiet.
4. Whether the front end shows a VAT summary block, and in what form, is Finance's
   call. The figures are on the endpoint either way.
