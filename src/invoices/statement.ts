// JOB C: customers reconciling several invoices by hand want one document.
//
// A statement is a read-only view over invoices that already exist. It works out
// nothing about money on its own: every figure comes from totalFor() in calc.ts,
// so a change to how an invoice totals (VAT, surcharges) shows up here without
// this file being touched.
//
// Dates on invoices are plain YYYY-MM-DD strings and are compared as strings.
// Nothing in here builds a Date, so nothing in here has a UTC/UK local problem.

import { format, sum, type Pence } from '../shared/money.ts';
import { totalFor, type InvoiceTotal } from './calc.ts';
import type { Customer, Invoice } from '../db.ts';

// Both bounds are inclusive. Either may be left out, which means unbounded.
export interface StatementPeriod {
  from: string | null;
  to: string | null;
}

export type StatementLine = InvoiceTotal & {
  invoiceId: string;
  issued: string;
  source: Invoice['source'];
  paid: boolean;
  // What is still owed on this invoice: the total, or nothing if it is settled.
  outstanding: Pence;
  display: {
    total: string;
    outstanding: string;
  };
};

export interface Statement {
  customer: {
    id: string;
    name: string;
    address: string;
    accountType: Customer['accountType'];
    vatRegistered: boolean;
  };
  period: StatementPeriod;
  // Unpaid invoices issued before the period started.
  broughtForward: Pence;
  lines: StatementLine[];
  // Everything invoiced in the period, settled or not.
  invoicedInPeriod: Pence;
  // broughtForward plus whatever in the period is still unpaid.
  closingBalance: Pence;
  display: {
    broughtForward: string;
    invoicedInPeriod: string;
    closingBalance: string;
  };
}

function within(issued: string, period: StatementPeriod): boolean {
  if (period.from !== null && issued < period.from) return false;
  if (period.to !== null && issued > period.to) return false;
  return true;
}

// An unasked-for period covers everything we have billed the customer, which is
// what "send me a statement" means when nobody says from when. One bound on its
// own is left one sided rather than being closed off by the data, so "from April"
// does not quietly become "April to whenever the last invoice happened to be".
function resolvePeriod(mine: Invoice[], requested: Partial<StatementPeriod>): StatementPeriod {
  if (requested.from == null && requested.to == null) {
    const issued = mine.map((i) => i.issued).sort();
    return { from: issued[0] ?? null, to: issued[issued.length - 1] ?? null };
  }
  return { from: requested.from ?? null, to: requested.to ?? null };
}

function lineFor(invoice: Invoice): StatementLine {
  const totals = totalFor(invoice);
  const outstanding = invoice.paid ? 0 : totals.total;

  return {
    invoiceId: invoice.id,
    issued: invoice.issued,
    source: invoice.source,
    paid: invoice.paid,
    // Spread, not picked apart, so anything calc.ts starts returning is carried.
    ...totals,
    outstanding,
    display: {
      total: format(totals.total),
      outstanding: format(outstanding),
    },
  };
}

export function statementFor(
  customer: Customer,
  all: Invoice[],
  requested: Partial<StatementPeriod> = {},
): Statement {
  const mine = all.filter((i) => i.customerId === customer.id);
  const period = resolvePeriod(mine, requested);

  const lines = mine
    .filter((i) => within(i.issued, period))
    .sort((a, b) => (a.issued === b.issued ? a.id.localeCompare(b.id) : a.issued.localeCompare(b.issued)))
    .map(lineFor);

  const broughtForward = sum(
    mine
      .filter((i) => !i.paid && period.from !== null && i.issued < period.from)
      .map((i) => totalFor(i).total),
  );

  const invoicedInPeriod = sum(lines.map((l) => l.total));
  const closingBalance = broughtForward + sum(lines.map((l) => l.outstanding));

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      address: customer.address,
      accountType: customer.accountType,
      vatRegistered: customer.vatRegistered,
    },
    period,
    broughtForward,
    lines,
    invoicedInPeriod,
    closingBalance,
    display: {
      broughtForward: format(broughtForward),
      invoicedInPeriod: format(invoicedInPeriod),
      closingBalance: format(closingBalance),
    },
  };
}
