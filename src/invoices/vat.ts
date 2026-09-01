// VAT liability rules. See docs/vat.md for where these come from and for the
// three things Finance still has to confirm.
//
// Two rules decide everything here:
//   - engineer work is a standard rated service for every customer
//   - water supply follows the customer, not the line
//
// A customer being VAT registered does not come into it. That decides whether
// they can reclaim the VAT, not what we charge.

import { percentOf, type Pence } from '../shared/money.ts';
import type { Customer, LineItem } from '../db.ts';

export type VatLiability = 'ZERO_RATED' | 'STANDARD_RATED';

export const RATE_PERCENT: Record<VatLiability, number> = {
  ZERO_RATED: 0,
  STANDARD_RATED: 20,
};

// Invoices show net and VAT per rate, not one lump. Finance reconcile against
// these bands.
export interface VatBand {
  liability: VatLiability;
  ratePercent: number;
  net: Pence;
  vat: Pence;
}

export function liabilityForLine(line: LineItem, customer: Customer): VatLiability {
  return line.kind === 'SERVICE' ? 'STANDARD_RATED' : customer.supplyVatLiability;
}

export function vatOn(net: Pence, liability: VatLiability): Pence {
  return percentOf(net, RATE_PERCENT[liability]);
}

// VAT is worked out once per rate on the summed net for that rate, not per line
// and added up. Both are allowed, but doing it per line lets the rounding drift
// by a penny per line against Sandra's spreadsheet.
export function bandsFor(netByLiability: Map<VatLiability, Pence>): VatBand[] {
  const order: VatLiability[] = ['STANDARD_RATED', 'ZERO_RATED'];
  return order
    .filter((liability) => netByLiability.has(liability))
    .map((liability) => {
      const net = netByLiability.get(liability)!;
      return { liability, ratePercent: RATE_PERCENT[liability], net, vat: vatOn(net, liability) };
    });
}
