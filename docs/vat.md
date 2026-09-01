# VAT on invoices

Written for JOB A. Covers what the code now does, what that rests on, and what is
still unanswered. If you change the VAT rules, change this file with them.

## What the code does

Two rules decide every line:

| Line kind | Rate | Depends on |
| --- | --- | --- |
| `SERVICE` (engineer work) | 20% | nothing, it is standard rated for everyone |
| `SUPPLY` (metered water, standing charge) | 0% or 20% | `customer.supplyVatLiability` |

The customer's `supplyVatLiability` is set per customer in `src/db.ts`. Domestic
customers are zero rated. Commercial customers are not automatically standard
rated, which is the part that is easy to get wrong.

VAT is worked out once per rate band on the summed net for that band, not per line
and then added up. Both are permitted, but per line rounding drifts by up to a
penny a line against a hand worked spreadsheet, and Sandra has been reconciling
against one.

`totalFor()` takes the customer as a second argument. It has to: the same lines
bill differently for different customers. It throws if the customer does not match
the invoice rather than quietly taxing on the wrong basis.

## What this rests on

1. **Water supplied to households is zero rated.** Not in doubt.
2. **Water supplied to industry is standard rated**, where industry means the
   customer's trade sits in Divisions 1 to 5 of the 1980 Standard Industrial
   Classification. Being a commercial account is not the same test, and neither is
   being VAT registered.
3. **Engineer work is a standard rated service.** Backflow tests and call outs are
   not part of the water supply.
4. **A customer being VAT registered changes nothing about what we charge them.**
   It decides whether they can reclaim it. Nothing in the calculation reads
   `vatRegistered`, and there is a test that fails if someone wires it in.
5. **The legacy postage surcharge is ancillary** to the supply on the invoice, so
   it is taxed at whatever that supply is taxed at. For the paper invoices we hold,
   all domestic, that means it stays untaxed and historic totals still reconcile.

## Open, and needs Sandra

We do not hold SIC codes, so points 2 above cannot be evaluated from our data. The
two commercial customers were classified by reading the account name. That is a
guess and it is marked as one: `supplyVatConfirmed: false`, surfaced on every total
as `vatConfirmed`, so nothing built on this mistakes a guess for a settled figure.

1. **Is Trelawney Foods standard rated?** Assumed yes, food production reads as
   Division 4. If wrong, we are overcharging them 20% on water.
2. **Is Severn Vale Academy zero rated?** Assumed yes, a school is not in Divisions
   1 to 5. If wrong, we have undercharged and owe HMRC the difference.
3. **What did Sandra's original email say?** JOB A records that "not all of it is
   vatable" and that the detail was not written down. The email is in the shared
   mailbox. The rules above are reconstructed from how UK water VAT normally works,
   not from what she actually said, and the two should be checked against each
   other before this goes anywhere near a customer.
4. **From when?** Nothing here is applied retrospectively to invoices already sent.
   If Finance want the invoices issued since the front end went live reissued with
   VAT on them, that is a separate piece of work and someone has to decide it.

Until 1 and 2 come back, treat any total with `vatConfirmed: false` as provisional.
Both current commercial customers are in that state.
