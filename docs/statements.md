# Customer statements

Written for JOB C. Trelawney Foods asked for "a statement like our other suppliers
send" because their finance team reconciles four invoice PDFs by hand every quarter.
The ticket says nobody had agreed what goes on it. This is what was built, and what
is still open.

## What it is

`GET /customers/:id/statement?from=YYYY-MM-DD&to=YYYY-MM-DD`

One JSON document per customer per period. The front end renders it; the API decides
nothing about layout.

`from` and `to` are optional and inclusive. Left out, the period spans everything we
have billed that customer, which is what "send me a statement" means when nobody says
from when. Anything that is not a `YYYY-MM-DD` key is a 400 rather than a silent
fallback, and so is a period that runs backwards.

## What goes on it

| Field | Meaning |
| --- | --- |
| `customer` | Who it is for. Name and address as billed. |
| `period` | The dates actually used, including the ones we resolved for you. |
| `broughtForward` | Unpaid invoices issued before the period started. |
| `lines[]` | One row per invoice in the period: id, issue date, source, whether it is settled, its net, VAT and rate bands, and what is still owed on it. |
| `netInPeriod`, `vatInPeriod` | The period split the way Finance reconcile it. |
| `invoicedInPeriod` | Everything billed in the period gross, settled or not. |
| `closingBalance` | `broughtForward` plus whatever in the period is still unpaid, gross. The one number the customer is reconciling to. |
| `vatConfirmed` | False when any line is taxed on an assumption Finance has not signed off (see `docs/vat.md`). The figures are usable, they are just not settled. |
| `display` | The same figures formatted as sterling, so the front end never divides by 100. |

Every figure comes out of `totalFor()` in `src/invoices/calc.ts`. The statement
computes no money of its own, so a change to how an invoice totals reaches the
statement without `statement.ts` being touched. Line rows spread the whole totals
object rather than picking fields off it, which is what makes that true.

Invoice dates are compared as `YYYY-MM-DD` strings. Nothing in the statement builds a
`Date`, so nothing in it can get UTC and UK local confused.

## Open points, not decided here

- **Payments have no date.** `Invoice.paid` is a boolean. That means this is an "as at
  today" snapshot of what is unpaid, not a dated ledger with payments as their own
  lines. A statement asked for last quarter today will not show what the balance was
  at the time. Real statements usually do. Fixing it needs a payments table, which is
  a bigger conversation than this ticket.
- **No period default.** An unasked-for period covers all history. If the customer
  wants "the last quarter" by default, that is a product decision and a clock
  dependency, and it should be made deliberately.
- **Unpaid invoices issued after `to`** are excluded from `closingBalance`. Correct for
  a period statement, and worth saying out loud because it means the closing balance
  and the account's outstanding balance are the same figure only when the period runs
  to today.
- **VAT.** JOB A landed while this was in review. The statement picked up net, VAT and
  the rate bands per line without `statement.ts` changing, which was the point of
  spreading the totals object; the merge needed only the new `customer` argument on
  `totalFor()`. `vatConfirmed` is carried up to the statement, so a statement is
  flagged as unsettled if any line on it is. Whether the front end shows a VAT summary
  block, and in what form, is Finance's call.
- **No PDF.** The ticket asks for one document; the front end team said they can render
  anything off an endpoint. This is the endpoint. Rendering is theirs.
