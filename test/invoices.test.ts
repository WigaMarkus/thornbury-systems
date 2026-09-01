import { test } from 'node:test';
import assert from 'node:assert/strict';
import { totalFor, lineTotal, outstandingFor } from '../src/invoices/calc.ts';
import { customers, invoices, type Invoice } from '../src/db.ts';

const customer = (id: string) => customers.find((c) => c.id === id)!;

test('line totals multiply quantity by unit price', () => {
  assert.equal(lineTotal({ description: 'x', quantity: 41, unitPence: 218, kind: 'SUPPLY' }), 8938);
});

test('every invoice totals to net plus VAT', () => {
  for (const invoice of invoices) {
    const result = totalFor(invoice, customer(invoice.customerId));
    assert.equal(result.total, result.net + result.vat, `${invoice.id} does not add up`);
    assert.equal(result.net, result.bands.reduce((a, b) => a + b.net, 0), `${invoice.id} net is not the bands`);
    assert.equal(result.vat, result.bands.reduce((a, b) => a + b.vat, 0), `${invoice.id} VAT is not the bands`);
    assert.ok(result.vat >= 0, `${invoice.id} has negative VAT`);
  }
});

test('outstanding balance ignores paid invoices', () => {
  // C-1001 has one invoice and it is settled.
  assert.equal(outstandingFor(customer('C-1001'), invoices), 0);
  // C-1003 has one invoice and it is not, so the balance is that invoice.
  assert.equal(outstandingFor(customer('C-1003'), invoices), totalFor(invoices.find((i) => i.id === 'INV-9003')!, customer('C-1003')).total);
});

test('commercial invoice totals', () => {
  const invoice = invoices.find((i) => i.id === 'INV-9002')!;
  const result = totalFor(invoice, customer('C-1002'));
  assert.equal(result.net, 245000);
  assert.equal(result.total, 294000);
});

test('legacy paper invoices carry the postage surcharge', () => {
  const paper: Invoice = {
    id: 'INV-0001',
    customerId: 'C-1001',
    issued: '2018-03-01',
    source: 'LEGACY_PAPER',
    paid: true,
    lines: [{ description: 'Metered supply', quantity: 10, unitPence: 100, kind: 'SUPPLY' }],
  };
  const result = totalFor(paper, customer('C-1001'));
  assert.equal(result.net, 1150);
  assert.equal(result.total, 1150);
});
