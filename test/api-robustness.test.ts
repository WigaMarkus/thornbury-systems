import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { server } from '../src/server.ts';

// The hardened server's promises: errors become responses instead of hangs,
// wrong methods are told what is allowed, and the read routes hold their shape.

let base = '';

before(async () => {
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('no port');
  base = `http://127.0.0.1:${address.port}`;
});

after(() => new Promise<void>((resolve) => server.close(() => resolve())));

test('a throwing route is a 500 that completes, not a hang', async () => {
  const res = await fetch(`${base}/__boom`);
  assert.equal(res.status, 500);
  // .json() only resolves if the response body actually arrived and finished.
  const body = await res.json();
  assert.equal(body.error, 'boom');
});

test('the wrong method on a known path is a 405 that names the right one', async () => {
  const res = await fetch(`${base}/customers`, { method: 'POST' });
  assert.equal(res.status, 405);
  const allow = res.headers.get('allow');
  assert.ok(allow !== null && allow.includes('GET'));
});

test('a single work order comes back by id', async () => {
  const res = await fetch(`${base}/work-orders/W-5001`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.id, 'W-5001');
  assert.ok(!Array.isArray(body));
});

test('an unknown work order is a 404', async () => {
  const res = await fetch(`${base}/work-orders/W-9999`);
  assert.equal(res.status, 404);
});

test('invoices for an unknown customer are a 404, not an empty list', async () => {
  const res = await fetch(`${base}/customers/C-0000/invoices`);
  assert.equal(res.status, 404);
});

test('a body that is not JSON is refused with a 400', async () => {
  const res = await fetch(`${base}/invoices/INV-9002/payments`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{not json',
  });
  assert.equal(res.status, 400);
});

test('every customer carries a numeric balance and its display string', async () => {
  const res = await fetch(`${base}/customers`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body) && body.length > 0);
  for (const customer of body) {
    assert.equal(typeof customer.outstandingPence, 'number');
    assert.ok(customer.outstanding.startsWith('£'));
  }
});

test('the banner advertises the engineers route', async () => {
  const body = await (await fetch(`${base}/`)).json();
  assert.ok(body.routes.includes('GET /engineers'));
});
