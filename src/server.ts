import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import * as repo from './repo.ts';
import { totalFor, outstandingFor } from './invoices/calc.ts';
import { statementFor } from './invoices/statement.ts';
import { dispatchDetailed } from './scheduling/dispatch.ts';
import { slotsFor, slotFor } from './scheduling/slots.ts';
import { normaliseAddress } from './scheduling/address.ts';
import { format } from './shared/money.ts';
import { sameUkDay, ukDateKey } from './shared/dates.ts';
import { json, CORS_HEADERS, HttpError, readJsonBody, serveStatic } from './http.ts';
import type { Customer, WorkOrder } from './db.ts';
import type { InvoiceRecord } from './repo.ts';

const PORT = Number(process.env.PORT ?? 4310);
const DATE_KEY = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

// A string that both looks like a date and is one. 2026-99-99 passes the regex
// but is not a day anyone can bill.
function isCalendarDate(value: string): boolean {
  if (!DATE_KEY.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

// --- response shapes ----------------------------------------------------------

function customerWithBalance(customer: Customer) {
  const outstandingPence = outstandingFor(customer, repo.listInvoices());
  return { ...customer, outstandingPence, outstanding: format(outstandingPence) };
}

function invoiceSummary(invoice: InvoiceRecord, customer: Customer, withCustomerName: boolean) {
  const totalPence = totalFor(invoice, customer).total;
  return {
    ...invoice,
    ...(withCustomerName ? { customerName: customer.name } : {}),
    totalPence,
    display: format(totalPence),
  };
}

function invoiceDetail(invoice: InvoiceRecord, customer: Customer) {
  const totals = totalFor(invoice, customer);
  const outstandingPence = invoice.paid ? 0 : totals.total;
  const payments = repo.listPayments(invoice.id).map((p) => ({
    id: p.id,
    amountPence: p.amountPence,
    paidOn: p.paidOn,
    recordedAt: p.recordedAt,
    display: format(p.amountPence),
  }));
  return {
    ...invoice,
    customerName: customer.name,
    ...totals,
    display: format(totals.total),
    displayNet: format(totals.net),
    displayVat: format(totals.vat),
    outstandingPence,
    payments,
  };
}

function enrichAssignments(assignments: { workOrderId: string; engineerId: string; address: string; startsAt: string }[]) {
  const engineers = repo.listEngineers();
  const orders = new Map(repo.listWorkOrders().map((o) => [o.id, o]));
  return assignments.map((a) => {
    const order = orders.get(a.workOrderId)!;
    const engineer = engineers.find((e) => e.id === a.engineerId);
    const customer = repo.getCustomer(order.customerId);
    const slot = slotFor(order);
    const endsAt = new Date(new Date(a.startsAt).getTime() + order.durationMinutes * 60_000).toISOString();
    return {
      workOrderId: a.workOrderId,
      engineerId: a.engineerId,
      engineerName: engineer?.name ?? a.engineerId,
      customerId: order.customerId,
      customerName: customer?.name ?? order.customerId,
      address: a.address,
      requires: order.requires,
      startsAt: a.startsAt,
      endsAt,
      window: slot.window,
      date: slot.date,
    };
  });
}

// --- route handlers -----------------------------------------------------------

type Handler = (req: IncomingMessage, res: ServerResponse, params: string[], url: URL) => void | Promise<void>;

interface Route {
  method: string;
  // Path split into segments; null is a wildcard whose value is passed to the
  // handler in order. Matching is exact-length.
  parts: (string | null)[];
  handler: Handler;
}

const ROUTES: Route[] = [
  {
    method: 'GET',
    parts: [],
    handler: (_req, res) => {
      json(res, 200, {
        service: 'Thornbury Systems billing and scheduling',
        version: '3.11.2',
        routes: [
          'GET /customers',
          'GET /customers/:id',
          'GET /customers/:id/invoices',
          'GET /customers/:id/statement?from=YYYY-MM-DD&to=YYYY-MM-DD',
          'GET /invoices',
          'GET /invoices/:id',
          'POST /invoices/:id/payments',
          'GET /engineers',
          'GET /work-orders',
          'GET /work-orders/:id',
          'POST /work-orders',
          'GET /dispatch',
          'POST /dispatch/run',
          'POST /dispatch/reset',
          'GET /slots',
          'GET /slots/:workOrderId',
        ],
      });
    },
  },

  {
    method: 'GET',
    parts: ['customers'],
    handler: (_req, res) => {
      json(res, 200, repo.listCustomers().map(customerWithBalance));
    },
  },

  {
    method: 'GET',
    parts: ['customers', null],
    handler: (_req, res, [id]) => {
      const customer = repo.getCustomer(id);
      if (!customer) return json(res, 404, { error: 'no such customer' });
      json(res, 200, customerWithBalance(customer));
    },
  },

  {
    method: 'GET',
    parts: ['customers', null, 'invoices'],
    handler: (_req, res, [id]) => {
      const customer = repo.getCustomer(id);
      if (!customer) return json(res, 404, { error: 'no such customer' });
      json(res, 200, repo.listInvoicesFor(id).map((i) => invoiceSummary(i, customer, false)));
    },
  },

  {
    method: 'GET',
    parts: ['customers', null, 'statement'],
    handler: (_req, res, [id], url) => {
      const customer = repo.getCustomer(id);
      if (!customer) return json(res, 404, { error: 'no such customer' });

      // Both are optional. A missing bound is unbounded; neither given means the
      // statement covers everything we have billed this customer.
      const from = url.searchParams.get('from');
      const to = url.searchParams.get('to');
      const bad = [from, to].find((v) => v !== null && !isCalendarDate(v));
      if (bad !== undefined) return json(res, 400, { error: 'from and to must be YYYY-MM-DD', got: bad });
      if (from && to && from > to) return json(res, 400, { error: 'from is after to', from, to });

      json(res, 200, statementFor(customer, repo.listInvoices(), { from, to }));
    },
  },

  {
    method: 'GET',
    parts: ['invoices'],
    handler: (_req, res) => {
      const customers = new Map(repo.listCustomers().map((c) => [c.id, c]));
      json(res, 200, repo.listInvoices().map((i) => invoiceSummary(i, customers.get(i.customerId)!, true)));
    },
  },

  {
    method: 'GET',
    parts: ['invoices', null],
    handler: (_req, res, [id]) => {
      const invoice = repo.getInvoice(id);
      if (!invoice) return json(res, 404, { error: 'no such invoice' });
      const customer = repo.getCustomer(invoice.customerId);
      if (!customer) return json(res, 500, { error: 'invoice has no customer', customerId: invoice.customerId });
      json(res, 200, invoiceDetail(invoice, customer));
    },
  },

  {
    method: 'POST',
    parts: ['invoices', null, 'payments'],
    handler: async (req, res, [id]) => {
      const invoice = repo.getInvoice(id);
      if (!invoice) return json(res, 404, { error: 'no such invoice' });
      if (invoice.paid) return json(res, 409, { error: 'invoice already paid', paidOn: invoice.paidOn });

      const customer = repo.getCustomer(invoice.customerId);
      if (!customer) return json(res, 500, { error: 'invoice has no customer', customerId: invoice.customerId });

      const body = await readJsonBody(req);

      let amountPence = totalFor(invoice, customer).total;
      if (body.amountPence !== undefined) {
        if (typeof body.amountPence !== 'number' || !Number.isInteger(body.amountPence) || body.amountPence <= 0) {
          return json(res, 400, { error: 'amountPence must be a positive integer', got: body.amountPence });
        }
        amountPence = body.amountPence;
      }

      let paidOn = ukDateKey(new Date());
      if (body.paidOn !== undefined) {
        if (typeof body.paidOn !== 'string' || !isCalendarDate(body.paidOn)) {
          return json(res, 400, { error: 'paidOn must be YYYY-MM-DD', got: body.paidOn });
        }
        paidOn = body.paidOn;
      }

      const payment = repo.recordPayment(invoice.id, amountPence, paidOn);
      const updated = repo.getInvoice(invoice.id)!;
      json(res, 201, {
        payment: { ...payment, display: format(payment.amountPence) },
        invoice: invoiceDetail(updated, customer),
      });
    },
  },

  {
    method: 'GET',
    parts: ['engineers'],
    handler: (_req, res) => {
      const active = repo.countDispatchedByEngineer();
      json(res, 200, repo.listEngineers().map((e) => ({
        id: e.id,
        name: e.name,
        skills: e.skills,
        activeOrders: active.get(e.id) ?? 0,
      })));
    },
  },

  {
    method: 'GET',
    parts: ['work-orders'],
    handler: (_req, res) => {
      const customers = new Map(repo.listCustomers().map((c) => [c.id, c]));
      json(res, 200, repo.listWorkOrders().map((w) => ({
        ...w,
        customerName: customers.get(w.customerId)?.name ?? w.customerId,
      })));
    },
  },

  {
    method: 'GET',
    parts: ['work-orders', null],
    handler: (_req, res, [id]) => {
      const order = repo.getWorkOrder(id);
      if (!order) return json(res, 404, { error: 'no such work order' });
      const customer = repo.getCustomer(order.customerId);
      const slot = slotFor(order);
      json(res, 200, {
        ...order,
        customerName: customer?.name ?? order.customerId,
        slot: { window: slot.window, date: slot.date },
      });
    },
  },

  {
    method: 'POST',
    parts: ['work-orders'],
    handler: async (req, res) => {
      const body = await readJsonBody(req);

      const customerId = typeof body.customerId === 'string' ? body.customerId : '';
      const customer = repo.getCustomer(customerId);
      if (!customer) return json(res, 400, { error: 'unknown customer', field: 'customerId' });

      const address = typeof body.address === 'string' ? body.address.trim() : '';
      if (address === '') return json(res, 400, { error: 'address must not be empty', field: 'address' });

      const requires = typeof body.requires === 'string' ? body.requires.trim().toUpperCase() : '';
      if (requires === '') return json(res, 400, { error: 'requires must not be empty', field: 'requires' });

      const requestedAt = typeof body.requestedAt === 'string' ? body.requestedAt : '';
      if (Number.isNaN(Date.parse(requestedAt))) {
        return json(res, 400, { error: 'requestedAt must be a valid timestamp', field: 'requestedAt' });
      }

      const durationMinutes = body.durationMinutes;
      if (typeof durationMinutes !== 'number' || !Number.isInteger(durationMinutes) || durationMinutes <= 0) {
        return json(res, 400, { error: 'durationMinutes must be a positive integer', field: 'durationMinutes' });
      }

      // Warnings do not block creation: the call taker decides, the system flags.
      const warnings: string[] = [];
      const when = new Date(requestedAt);
      const addressKey = normaliseAddress(address);
      const duplicate = repo.listWorkOrders().some(
        (w) => w.status !== 'DONE'
          && normaliseAddress(w.address) === addressKey
          && sameUkDay(new Date(w.requestedAt), when),
      );
      if (duplicate) warnings.push('DUPLICATE_VISIT_SAME_DAY');
      if (!repo.listEngineers().some((e) => e.skills.includes(requires))) {
        warnings.push('NO_ENGINEER_WITH_SKILL');
      }

      const workOrder = repo.createWorkOrder({ customerId, address, requires, requestedAt, durationMinutes });
      json(res, 201, { workOrder, warnings });
    },
  },

  {
    method: 'GET',
    parts: ['dispatch'],
    handler: (_req, res) => {
      const result = dispatchDetailed(repo.listWorkOrders());
      json(res, 200, {
        assignments: enrichAssignments(result.assignments),
        unassigned: result.unassigned,
      });
    },
  },

  {
    method: 'POST',
    parts: ['dispatch', 'run'],
    handler: (_req, res) => {
      const result = dispatchDetailed(repo.listWorkOrders());
      // Enrich before persisting so the slot and status reflect the plan that
      // was just made, then write the plan down.
      const assignments = enrichAssignments(result.assignments);
      const dispatchedCount = repo.markDispatched(result.assignments);
      json(res, 200, {
        assignments,
        unassigned: result.unassigned,
        dispatchedCount,
      });
    },
  },

  {
    method: 'POST',
    parts: ['dispatch', 'reset'],
    handler: (_req, res) => {
      json(res, 200, { requeued: repo.requeueAll() });
    },
  },

  {
    method: 'GET',
    parts: ['slots'],
    handler: (_req, res) => {
      json(res, 200, slotsFor(repo.listWorkOrders()));
    },
  },

  {
    method: 'GET',
    parts: ['slots', null],
    handler: (_req, res, [id]) => {
      const order = repo.getWorkOrder(id);
      if (!order) return json(res, 404, { error: 'no such work order' });
      json(res, 200, slotFor(order));
    },
  },

  {
    method: 'GET',
    parts: ['__boom'],
    handler: () => {
      // Deliberately unhandled: proves a throwing route is a 500, not a hang.
      throw new Error('boom');
    },
  },
];

// --- request dispatch ---------------------------------------------------------

function matches(route: Route, parts: string[]): boolean {
  if (route.parts.length !== parts.length) return false;
  return route.parts.every((p, i) => p === null || p === parts[i]);
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const parts = url.pathname.split('/').filter(Boolean).map((s) => decodeURIComponent(s));
  const method = req.method ?? 'GET';

  if (method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    return res.end();
  }

  // The same URLs serve two audiences. A navigating browser sends
  // Accept: text/html and gets the front end (so / and /customers render the
  // app, and a refresh on a client-side route works); the test suite, curl and
  // the front end's own fetch calls send */* and get the JSON API.
  if (method === 'GET' && (req.headers.accept ?? '').includes('text/html') && serveStatic(req, res, url)) {
    return;
  }

  const pathMatches = ROUTES.filter((r) => matches(r, parts));
  const route = pathMatches.find((r) => r.method === method);

  if (route) {
    const params = parts.filter((_, i) => route.parts[i] === null);
    return route.handler(req, res, params, url);
  }

  if (pathMatches.length > 0) {
    const allow = [...new Set(pathMatches.map((r) => r.method))].concat('OPTIONS').join(', ');
    return json(res, 405, { error: 'method not allowed', method, path: url.pathname }, { allow });
  }

  if (method === 'GET' && serveStatic(req, res, url)) return;

  return json(res, 404, { error: 'no such route', path: url.pathname });
}

export const server = createServer((req, res) => {
  // Nothing may leave the socket hanging: whatever a handler throws, the
  // response is finished one way or another.
  Promise.resolve()
    .then(() => handle(req, res))
    .catch((err: unknown) => {
      if (err instanceof HttpError) {
        if (!res.headersSent) return json(res, err.status, { error: err.message, ...err.extra });
        return res.end();
      }
      const message = err instanceof Error ? err.message : String(err);
      if (!res.headersSent) return json(res, 500, { error: message });
      res.end();
    });
});

if (process.argv[1]?.endsWith('server.ts')) {
  server.listen(PORT, () => {
    console.log(`Thornbury Systems listening on http://localhost:${PORT}`);
  });
}
