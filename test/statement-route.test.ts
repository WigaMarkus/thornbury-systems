import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { server } from '../src/server.ts';

// The statement is only useful if it comes off an endpoint, so the endpoint is
// tested rather than assumed. A green calc suite said nothing about the route.

let base = '';

before(async () => {
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('no port');
  base = `http://127.0.0.1:${address.port}`;
});

after(() => new Promise<void>((resolve) => server.close(() => resolve())));

test('the statement route is advertised', async () => {
  const body = await (await fetch(`${base}/`)).json();
  assert.ok(body.routes.some((r: string) => r.startsWith('GET /customers/:id/statement')));
});

test('a customer gets one document covering every invoice', async () => {
  const res = await fetch(`${base}/customers/C-1002/statement`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.customer.name, 'Trelawney Foods Ltd');
  assert.ok(body.lines.length >= 1);
  assert.ok(body.display.closingBalance.startsWith('£'));
});

test('a valid quarter is accepted and filters the lines', async () => {
  const res = await fetch(`${base}/customers/C-1004/statement?from=2026-04-01&to=2026-06-30`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.period, { from: '2026-04-01', to: '2026-06-30' });
  assert.deepEqual(body.lines.map((l: { invoiceId: string }) => l.invoiceId), ['INV-9004']);
});

test('a quarter with nothing in it is an empty statement, not an error', async () => {
  const res = await fetch(`${base}/customers/C-1002/statement?from=2026-01-01&to=2026-03-31`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.lines, []);
});

test('rubbish dates are refused rather than silently ignored', async () => {
  const res = await fetch(`${base}/customers/C-1002/statement?from=last-tuesday`);
  assert.equal(res.status, 400);
  assert.equal((await res.json()).got, 'last-tuesday');
});

test('a period that runs backwards is refused', async () => {
  const res = await fetch(`${base}/customers/C-1002/statement?from=2026-07-01&to=2026-04-01`);
  assert.equal(res.status, 400);
});

test('an unknown customer is a 404', async () => {
  const res = await fetch(`${base}/customers/C-0000/statement`);
  assert.equal(res.status, 404);
});
