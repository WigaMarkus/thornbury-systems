import { sum, type Pence } from '../shared/money.ts';
import { bandsFor, liabilityForLine, type VatBand, type VatLiability } from './vat.ts';
import type { Customer, Invoice, LineItem } from '../db.ts';

export interface InvoiceTotal {
  net: Pence;
  vat: Pence;
  total: Pence;
  bands: VatBand[];
  // False when any part of this invoice is taxed on an assumption Finance has
  // not signed off. The number is still usable, it just is not settled.
  vatConfirmed: boolean;
}

export function lineTotal(line: LineItem): Pence {
  return line.quantity * line.unitPence;
}

// Paper invoices carried a printing and postage charge that the web product
// never had. Kept so historic invoices still reconcile.
export function legacySurcharge(invoice: Invoice): Pence {
  if (invoice.source === 'LEGACY_PAPER') {
    return 150;
  }
  return 0;
}

// The customer is needed because water supply is zero rated for some of them and
// standard rated for others. Passing the wrong one silently mistaxes the invoice,
// so it is checked rather than trusted.
export function totalFor(invoice: Invoice, customer: Customer): InvoiceTotal {
  if (customer.id !== invoice.customerId) {
    throw new Error(`invoice ${invoice.id} belongs to ${invoice.customerId}, not ${customer.id}`);
  }

  const netByLiability = new Map<VatLiability, Pence>();
  const add = (liability: VatLiability, amount: Pence) => {
    netByLiability.set(liability, (netByLiability.get(liability) ?? 0) + amount);
  };

  for (const line of invoice.lines) {
    add(liabilityForLine(line, customer), lineTotal(line));
  }

  // The postage charge is ancillary to the supply being invoiced, so it is taxed
  // the same way the supply is rather than on its own footing.
  const surcharge = legacySurcharge(invoice);
  if (surcharge > 0) {
    add(customer.supplyVatLiability, surcharge);
  }

  const bands = bandsFor(netByLiability);
  const net = sum(bands.map((b) => b.net));
  const vat = sum(bands.map((b) => b.vat));

  // An invoice with no supply lines is fully determined by the service rule, so
  // the unconfirmed supply liability does not affect it.
  const touchesSupply = surcharge > 0 || invoice.lines.some((line) => line.kind === 'SUPPLY');

  return {
    net,
    vat,
    total: net + vat,
    bands,
    vatConfirmed: customer.supplyVatConfirmed || !touchesSupply,
  };
}

export function outstandingFor(customer: Customer, all: Invoice[]): Pence {
  return sum(
    all
      .filter((i) => i.customerId === customer.id && !i.paid)
      .map((i) => totalFor(i, customer).total),
  );
}
