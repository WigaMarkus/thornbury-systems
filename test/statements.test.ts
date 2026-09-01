import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statementFor } from '../src/invoices/statement.ts';
import { totalFor, outstandingFor } from '../src/invoices/calc.ts';
import { customers, invoices, type Customer, type Invoice } from '../src/db.ts';

const trelawney = customers.find((c) => c.id === 'C-1002')!;

// The case on the ticket: one commercial customer, a quarter's worth of invoices,
// some settled and some not, reconciled by hand today.
const acme: Customer = {
  id: 'C-9999',
  name: 'Acme Ltd',
  address: 'Somewhere',
  accountType: 'COMMERCIAL',
  vatRegistered: true,
};

function invoice(id: string, issued: string, pence: number, paid: boolean): Invoice {
  return {
    id,
    customerId: acme.id,
    issued,
    source: 'BATCH',
    paid,
    lines: [{ description: 'Metered supply', quantity: 1, unitPence: pence, kind: 'SUPPLY' }],
  };
}

const quarter: Invoice[] = [
  invoice('INV-1', '2026-03-31', 5000, false), // before the quarter, unpaid
  invoice('INV-2', '2026-04-01', 10000, true),
  invoice('INV-3', '2026-05-01', 20000, false),
  invoice('INV-4', '2026-06-30', 30000, false),
  invoice('INV-5', '2026-07-01', 40000, false), // after the quarter
  invoice('INV-6', '2026-05-15', 99999, false), // another customer's, see below
];
quarter[5]!.customerId = 'C-1001';

test('a statement covers only that customer, only in the period', () => {
  const s = statementFor(acme, quarter, { from: '2026-04-01', to: '2026-06-30' });
  assert.deepEqual(s.lines.map((l) => l.invoiceId), ['INV-2', 'INV-3', 'INV-4']);
});

test('lines are ordered by issue date', () => {
  const shuffled = [quarter[3]!, quarter[1]!, quarter[2]!];
  const s = statementFor(acme, shuffled, { from: '2026-04-01', to: '2026-06-30' });
  assert.deepEqual(s.lines.map((l) => l.issued), ['2026-04-01', '2026-05-01', '2026-06-30']);
});

test('unpaid invoices from before the period are brought forward', () => {
  const s = statementFor(acme, quarter, { from: '2026-04-01', to: '2026-06-30' });
  assert.equal(s.broughtForward, 5000);
});

test('settled invoices still appear but owe nothing', () => {
  const s = statementFor(acme, quarter, { from: '2026-04-01', to: '2026-06-30' });
  const settled = s.lines.find((l) => l.invoiceId === 'INV-2')!;
  assert.equal(settled.total, 10000);
  assert.equal(settled.outstanding, 0);
});

test('the closing balance is what the customer owes at the end of the period', () => {
  const s = statementFor(acme, quarter, { from: '2026-04-01', to: '2026-06-30' });
  // 5000 brought forward, 20000 + 30000 unpaid in the quarter. INV-2 is settled
  // and INV-5 falls outside the period.
  assert.equal(s.invoicedInPeriod, 60000);
  assert.equal(s.closingBalance, 55000);
});

test('over the whole account the closing balance agrees with the outstanding balance', () => {
  const s = statementFor(acme, quarter);
  assert.equal(s.closingBalance, outstandingFor(acme.id, quarter));
});

test('an unasked-for period spans everything we have billed', () => {
  const s = statementFor(acme, quarter);
  assert.deepEqual(s.period, { from: '2026-03-31', to: '2026-07-01' });
  assert.equal(s.lines.length, 5);
});

test('a customer we have never invoiced gets an empty statement, not an error', () => {
  const s = statementFor(acme, []);
  assert.deepEqual(s.period, { from: null, to: null });
  assert.deepEqual(s.lines, []);
  assert.equal(s.broughtForward, 0);
  assert.equal(s.closingBalance, 0);
  assert.equal(s.display.closingBalance, '£0.00');
});

test('money is formatted for the front end, not just handed over in pence', () => {
  const s = statementFor(acme, quarter, { from: '2026-04-01', to: '2026-06-30' });
  assert.equal(s.display.broughtForward, '£50.00');
  assert.equal(s.display.invoicedInPeriod, '£600.00');
  assert.equal(s.display.closingBalance, '£550.00');
  assert.equal(s.lines[0]!.display.total, '£100.00');
  assert.equal(s.lines[0]!.display.outstanding, '£0.00');
});

test('line figures come from the invoice calculation, not from the statement', () => {
  const s = statementFor(trelawney, invoices);
  for (const line of s.lines) {
    const source = invoices.find((i) => i.id === line.invoiceId)!;
    assert.deepEqual({ net: line.net, total: line.total }, totalFor(source));
  }
});

test('the real account reconciles to one figure', () => {
  const s = statementFor(trelawney, invoices);
  assert.equal(s.customer.name, 'Trelawney Foods Ltd');
  assert.equal(s.closingBalance, outstandingFor('C-1002', invoices));
});

test('one bound on its own stays one sided', () => {
  const fromApril = statementFor(acme, quarter, { from: '2026-04-01' });
  assert.deepEqual(fromApril.period, { from: '2026-04-01', to: null });
  assert.deepEqual(fromApril.lines.map((l) => l.invoiceId), ['INV-2', 'INV-3', 'INV-4', 'INV-5']);
  assert.equal(fromApril.broughtForward, 5000);

  const untilMay = statementFor(acme, quarter, { to: '2026-05-01' });
  assert.deepEqual(untilMay.period, { from: null, to: '2026-05-01' });
  assert.deepEqual(untilMay.lines.map((l) => l.invoiceId), ['INV-1', 'INV-2', 'INV-3']);
  assert.equal(untilMay.broughtForward, 0);
});
