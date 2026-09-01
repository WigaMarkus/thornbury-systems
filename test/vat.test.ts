import { test } from 'node:test';
import assert from 'node:assert/strict';
import { totalFor, outstandingFor } from '../src/invoices/calc.ts';
import { customers, invoices, type Customer, type Invoice } from '../src/db.ts';

const customer = (id: string): Customer => customers.find((c) => c.id === id)!;
const invoice = (id: string): Invoice => invoices.find((i) => i.id === id)!;

// Mrs Whitcombe. Domestic water, nothing else on the invoice.
test('domestic supply is zero rated', () => {
  const result = totalFor(invoice('INV-9001'), customer('C-1001'));
  assert.equal(result.net, 11338);
  assert.equal(result.vat, 0);
  assert.equal(result.total, 11338);
});

// Trelawney. Standard rated supply plus a backflow test, both at 20%, so they
// land in one band rather than two.
test('commercial supply and service share the standard band', () => {
  const result = totalFor(invoice('INV-9002'), customer('C-1002'));
  assert.equal(result.net, 245000);
  assert.equal(result.vat, 49000);
  assert.equal(result.total, 294000);
  assert.deepEqual(result.bands, [
    { liability: 'STANDARD_RATED', ratePercent: 20, net: 245000, vat: 49000 },
  ]);
});

// Dr Kowalski. This is the case Sandra meant: the water is not vatable but the
// call out is, on the same invoice.
test('a domestic invoice taxes the call out but not the water', () => {
  const result = totalFor(invoice('INV-9003'), customer('C-1003'));
  assert.deepEqual(result.bands, [
    { liability: 'STANDARD_RATED', ratePercent: 20, net: 14000, vat: 2800 },
    { liability: 'ZERO_RATED', ratePercent: 0, net: 9594, vat: 0 },
  ]);
  assert.equal(result.net, 23594);
  assert.equal(result.vat, 2800);
  assert.equal(result.total, 26394);
});

// Severn Vale Academy is a commercial account and is VAT registered, and its
// water is still zero rated. If this test starts failing because someone keyed
// the rate off accountType or off vatRegistered, that is the bug.
test('a commercial account is not automatically standard rated', () => {
  const school = customer('C-1004');
  assert.equal(school.accountType, 'COMMERCIAL');
  assert.equal(school.vatRegistered, true);
  const result = totalFor(invoice('INV-9004'), school);
  assert.equal(result.vat, 0);
  assert.equal(result.total, 563400);
});

test('being VAT registered does not change the rate charged', () => {
  // Same lines, same liability, one registered and one not. Same VAT.
  const lines: Invoice['lines'] = [{ description: 'Call out', quantity: 1, unitPence: 10000, kind: 'SERVICE' }];
  const registered = totalFor(
    { id: 'INV-T1', customerId: 'C-1002', issued: '2026-07-01', source: 'WEB', paid: false, lines },
    customer('C-1002'),
  );
  const notRegistered = totalFor(
    { id: 'INV-T2', customerId: 'C-1001', issued: '2026-07-01', source: 'WEB', paid: false, lines },
    customer('C-1001'),
  );
  assert.equal(registered.vat, 2000);
  assert.equal(notRegistered.vat, 2000);
});

test('VAT is rounded to the penny', () => {
  const odd = (unitPence: number) =>
    totalFor(
      {
        id: 'INV-T3', customerId: 'C-1001', issued: '2026-07-01', source: 'WEB', paid: false,
        lines: [{ description: 'Call out', quantity: 1, unitPence, kind: 'SERVICE' }],
      },
      customer('C-1001'),
    ).vat;
  assert.equal(odd(333), 67); // 66.6 rounds up
  assert.equal(odd(1234), 247); // 246.8 rounds up
  assert.equal(odd(1230), 246); // exact, no rounding
});

// Historic paper invoices still have to reconcile to what was posted at the time.
test('the postage surcharge follows the supply it sits on', () => {
  const paper = (customerId: string): Invoice => ({
    id: 'INV-0001', customerId, issued: '2018-03-01', source: 'LEGACY_PAPER', paid: true,
    lines: [{ description: 'Metered supply', quantity: 10, unitPence: 100, kind: 'SUPPLY' }],
  });
  // Zero rated supply, so the surcharge is not taxed either and the historic
  // total of 1150 is unchanged.
  assert.equal(totalFor(paper('C-1001'), customer('C-1001')).total, 1150);
  // Standard rated supply, so the surcharge is taxed with it: 1150 + 20%.
  assert.equal(totalFor(paper('C-1002'), customer('C-1002')).total, 1380);
});

test('outstanding balance is VAT inclusive', () => {
  assert.equal(outstandingFor(customer('C-1003'), invoices), 26394);
  assert.equal(outstandingFor(customer('C-1002'), invoices), 294000);
});

test('outstanding balance still ignores paid invoices', () => {
  // Both of these customers have invoices, and both are settled.
  assert.equal(outstandingFor(customer('C-1001'), invoices), 0);
  assert.equal(outstandingFor(customer('C-1004'), invoices), 0);
});

test('totals refuse a customer the invoice does not belong to', () => {
  assert.throws(
    () => totalFor(invoice('INV-9002'), customer('C-1001')),
    /belongs to C-1002/,
  );
});

test('invoices resting on an unconfirmed liability are flagged', () => {
  // Trelawney's supply rate is a guess until Finance confirm it.
  assert.equal(totalFor(invoice('INV-9002'), customer('C-1002')).vatConfirmed, false);
  // Domestic is not a guess.
  assert.equal(totalFor(invoice('INV-9003'), customer('C-1003')).vatConfirmed, true);
  // Neither is a services only invoice, whoever it is for: services are standard
  // rated regardless of the supply liability.
  const servicesOnly = totalFor(
    {
      id: 'INV-T4', customerId: 'C-1002', issued: '2026-07-01', source: 'WEB', paid: false,
      lines: [{ description: 'Backflow device test', quantity: 1, unitPence: 8500, kind: 'SERVICE' }],
    },
    customer('C-1002'),
  );
  assert.equal(servicesOnly.vatConfirmed, true);
  assert.equal(servicesOnly.vat, 1700);
});
