// SQLite persistence layer. Replaces the in-memory arrays in db.ts as the data
// source for the HTTP server; db.ts remains the seed source and the home of the
// TypeScript shapes, so everything downstream keeps the exact types it had.
//
// Under `node --test` (NODE_TEST_CONTEXT set) the database is in-memory, so each
// test file gets a fresh, isolated store and no file is written. Otherwise the
// database lives at data/thornbury.db (override with THORNBURY_DB).

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  customers as seedCustomers,
  invoices as seedInvoices,
  engineers as seedEngineers,
  workOrders as seedWorkOrders,
  type Customer,
  type Invoice,
  type LineItem,
  type Engineer,
  type WorkOrder,
} from './db.ts';
import { totalFor } from './invoices/calc.ts';

export interface Payment {
  id: number;
  invoiceId: string;
  amountPence: number;
  paidOn: string;
  recordedAt: string;
}

const dbPath =
  process.env.THORNBURY_DB ??
  (process.env.NODE_TEST_CONTEXT
    ? ':memory:'
    : fileURLToPath(new URL('../data/thornbury.db', import.meta.url)));

if (dbPath !== ':memory:') {
  mkdirSync(dirname(dbPath), { recursive: true });
}

const db = new DatabaseSync(dbPath);

if (dbPath !== ':memory:') {
  db.exec('PRAGMA journal_mode = WAL');
}
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN ('DOMESTIC', 'COMMERCIAL')),
    vat_registered INTEGER NOT NULL,
    supply_vat_liability TEXT NOT NULL CHECK (supply_vat_liability IN ('ZERO_RATED', 'STANDARD_RATED')),
    supply_vat_confirmed INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    issued TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('WEB', 'BATCH', 'LEGACY_PAPER')),
    paid INTEGER NOT NULL DEFAULT 0,
    paid_on TEXT NULL
  );

  CREATE TABLE IF NOT EXISTS invoice_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id TEXT NOT NULL REFERENCES invoices(id),
    position INTEGER NOT NULL,
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_pence INTEGER NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('SUPPLY', 'SERVICE'))
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id TEXT NOT NULL REFERENCES invoices(id),
    amount_pence INTEGER NOT NULL,
    paid_on TEXT NOT NULL,
    recorded_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS engineers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    skills TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS work_orders (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    address TEXT NOT NULL,
    requires TEXT NOT NULL,
    requested_at TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('QUEUED', 'DISPATCHED', 'DONE')) DEFAULT 'QUEUED',
    engineer_id TEXT NULL REFERENCES engineers(id)
  );

  CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
  CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_lines(invoice_id);
  CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
  CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
`);

function seedIfEmpty() {
  const row = db.prepare('SELECT COUNT(*) AS n FROM customers').get() as { n: number };
  if (row.n > 0) return;

  const insertCustomer = db.prepare(
    `INSERT INTO customers (id, name, address, account_type, vat_registered, supply_vat_liability, supply_vat_confirmed)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertInvoice = db.prepare(
    `INSERT INTO invoices (id, customer_id, issued, source, paid, paid_on)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const insertLine = db.prepare(
    `INSERT INTO invoice_lines (invoice_id, position, description, quantity, unit_pence, kind)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const insertPayment = db.prepare(
    `INSERT INTO payments (invoice_id, amount_pence, paid_on, recorded_at)
     VALUES (?, ?, ?, ?)`,
  );
  const insertEngineer = db.prepare('INSERT INTO engineers (id, name, skills) VALUES (?, ?, ?)');
  const insertWorkOrder = db.prepare(
    `INSERT INTO work_orders (id, customer_id, address, requires, requested_at, duration_minutes, status, engineer_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  db.exec('BEGIN');
  try {
    for (const c of seedCustomers) {
      insertCustomer.run(
        c.id, c.name, c.address, c.accountType,
        c.vatRegistered ? 1 : 0, c.supplyVatLiability, c.supplyVatConfirmed ? 1 : 0,
      );
    }
    for (const i of seedInvoices) {
      insertInvoice.run(i.id, i.customerId, i.issued, i.source, i.paid ? 1 : 0, i.paid ? i.issued : null);
      i.lines.forEach((line, position) => {
        insertLine.run(i.id, position, line.description, line.quantity, line.unitPence, line.kind);
      });
      if (i.paid) {
        // Seed-paid invoices get one synthetic settlement so the payment history
        // reconciles with the paid flag.
        const customer = seedCustomers.find((c) => c.id === i.customerId)!;
        insertPayment.run(i.id, totalFor(i, customer).total, i.issued, `${i.issued}T00:00:00Z`);
      }
    }
    for (const e of seedEngineers) {
      insertEngineer.run(e.id, e.name, JSON.stringify(e.skills));
    }
    for (const w of seedWorkOrders) {
      insertWorkOrder.run(
        w.id, w.customerId, w.address, w.requires, w.requestedAt,
        w.durationMinutes, w.status, w.engineerId ?? null,
      );
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

seedIfEmpty();

// --- row -> domain shape mapping ---------------------------------------------

interface CustomerRow {
  id: string; name: string; address: string; account_type: string;
  vat_registered: number; supply_vat_liability: string; supply_vat_confirmed: number;
}

function toCustomer(r: CustomerRow): Customer {
  return {
    id: r.id,
    name: r.name,
    address: r.address,
    accountType: r.account_type as Customer['accountType'],
    vatRegistered: !!r.vat_registered,
    supplyVatLiability: r.supply_vat_liability as Customer['supplyVatLiability'],
    supplyVatConfirmed: !!r.supply_vat_confirmed,
  };
}

interface InvoiceRow {
  id: string; customer_id: string; issued: string; source: string;
  paid: number; paid_on: string | null;
}

const selectLines = db.prepare(
  `SELECT description, quantity, unit_pence, kind
   FROM invoice_lines WHERE invoice_id = ? ORDER BY position`,
);

function linesFor(invoiceId: string): LineItem[] {
  const rows = selectLines.all(invoiceId) as {
    description: string; quantity: number; unit_pence: number; kind: string;
  }[];
  return rows.map((r) => ({
    description: r.description,
    quantity: r.quantity,
    unitPence: r.unit_pence,
    kind: r.kind as LineItem['kind'],
  }));
}

export type InvoiceRecord = Invoice & { paidOn: string | null };

function toInvoice(r: InvoiceRow): InvoiceRecord {
  return {
    id: r.id,
    customerId: r.customer_id,
    issued: r.issued,
    lines: linesFor(r.id),
    source: r.source as Invoice['source'],
    paid: !!r.paid,
    paidOn: r.paid_on,
  };
}

interface WorkOrderRow {
  id: string; customer_id: string; address: string; requires: string;
  requested_at: string; duration_minutes: number; status: string; engineer_id: string | null;
}

function toWorkOrder(r: WorkOrderRow): WorkOrder {
  const order: WorkOrder = {
    id: r.id,
    customerId: r.customer_id,
    address: r.address,
    requires: r.requires,
    requestedAt: r.requested_at,
    durationMinutes: r.duration_minutes,
    status: r.status as WorkOrder['status'],
  };
  // The key is only present when set, matching the optional field on the seed shape.
  if (r.engineer_id !== null) order.engineerId = r.engineer_id;
  return order;
}

interface PaymentRow {
  id: number; invoice_id: string; amount_pence: number; paid_on: string; recorded_at: string;
}

function toPayment(r: PaymentRow): Payment {
  return {
    id: r.id,
    invoiceId: r.invoice_id,
    amountPence: r.amount_pence,
    paidOn: r.paid_on,
    recordedAt: r.recorded_at,
  };
}

// --- queries ------------------------------------------------------------------

export function listCustomers(): Customer[] {
  return (db.prepare('SELECT * FROM customers ORDER BY id').all() as unknown as CustomerRow[]).map(toCustomer);
}

export function getCustomer(id: string): Customer | undefined {
  const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as unknown as CustomerRow | undefined;
  return row ? toCustomer(row) : undefined;
}

export function listInvoices(): InvoiceRecord[] {
  return (db.prepare('SELECT * FROM invoices ORDER BY id').all() as unknown as InvoiceRow[]).map(toInvoice);
}

export function listInvoicesFor(customerId: string): InvoiceRecord[] {
  return (
    db.prepare('SELECT * FROM invoices WHERE customer_id = ? ORDER BY id').all(customerId) as unknown as InvoiceRow[]
  ).map(toInvoice);
}

export function getInvoice(id: string): InvoiceRecord | undefined {
  const row = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as unknown as InvoiceRow | undefined;
  return row ? toInvoice(row) : undefined;
}

export function listPayments(invoiceId: string): Payment[] {
  return (
    db.prepare('SELECT * FROM payments WHERE invoice_id = ? ORDER BY id').all(invoiceId) as unknown as PaymentRow[]
  ).map(toPayment);
}

// Settling the invoice is conditional on it not being settled already: the
// UPDATE only matches an unpaid row, so of two concurrent payments exactly one
// wins and the other gets null back. The payment row is only inserted on the
// winning path, keeping the history at one settlement per invoice.
export function recordPayment(invoiceId: string, amountPence: number, paidOn: string): Payment | null {
  const recordedAt = new Date().toISOString();
  db.exec('BEGIN');
  try {
    const settled = db
      .prepare('UPDATE invoices SET paid = 1, paid_on = ? WHERE id = ? AND paid = 0')
      .run(paidOn, invoiceId);
    if (Number(settled.changes) !== 1) {
      db.exec('ROLLBACK');
      return null;
    }
    const result = db
      .prepare('INSERT INTO payments (invoice_id, amount_pence, paid_on, recorded_at) VALUES (?, ?, ?, ?)')
      .run(invoiceId, amountPence, paidOn, recordedAt);
    db.exec('COMMIT');
    return {
      id: Number(result.lastInsertRowid),
      invoiceId,
      amountPence,
      paidOn,
      recordedAt,
    };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function listEngineers(): Engineer[] {
  const rows = db.prepare('SELECT * FROM engineers ORDER BY id').all() as unknown as {
    id: string; name: string; skills: string;
  }[];
  return rows.map((r) => ({ id: r.id, name: r.name, skills: JSON.parse(r.skills) as string[] }));
}

export function countDispatchedByEngineer(): Map<string, number> {
  const rows = db
    .prepare(
      `SELECT engineer_id, COUNT(*) AS n FROM work_orders
       WHERE status = 'DISPATCHED' AND engineer_id IS NOT NULL GROUP BY engineer_id`,
    )
    .all() as unknown as { engineer_id: string; n: number }[];
  return new Map(rows.map((r) => [r.engineer_id, r.n]));
}

export function listWorkOrders(): WorkOrder[] {
  return (db.prepare('SELECT * FROM work_orders ORDER BY id').all() as unknown as WorkOrderRow[]).map(toWorkOrder);
}

export function getWorkOrder(id: string): WorkOrder | undefined {
  const row = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(id) as unknown as WorkOrderRow | undefined;
  return row ? toWorkOrder(row) : undefined;
}

export interface NewWorkOrder {
  customerId: string;
  address: string;
  requires: string;
  requestedAt: string;
  durationMinutes: number;
}

export function createWorkOrder(input: NewWorkOrder): WorkOrder {
  // Ids continue the W-nnnn sequence from the highest numeric suffix in the table.
  const rows = db.prepare('SELECT id FROM work_orders').all() as unknown as { id: string }[];
  const max = rows.reduce((acc, r) => {
    const n = Number(r.id.replace(/^W-/, ''));
    return Number.isFinite(n) && n > acc ? n : acc;
  }, 0);
  const id = `W-${max + 1}`;

  db.prepare(
    `INSERT INTO work_orders (id, customer_id, address, requires, requested_at, duration_minutes, status, engineer_id)
     VALUES (?, ?, ?, ?, ?, ?, 'QUEUED', NULL)`,
  ).run(id, input.customerId, input.address, input.requires, input.requestedAt, input.durationMinutes);

  return getWorkOrder(id)!;
}

export function markDispatched(assignments: { workOrderId: string; engineerId: string }[]): number {
  const update = db.prepare(
    `UPDATE work_orders SET status = 'DISPATCHED', engineer_id = ? WHERE id = ? AND status = 'QUEUED'`,
  );
  let changed = 0;
  db.exec('BEGIN');
  try {
    for (const a of assignments) {
      changed += Number(update.run(a.engineerId, a.workOrderId).changes);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return changed;
}

export function requeueAll(): number {
  const run = db
    .prepare(`UPDATE work_orders SET status = 'QUEUED', engineer_id = NULL WHERE status = 'DISPATCHED'`)
    .run();
  return Number(run.changes);
}
