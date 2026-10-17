import test from 'node:test';
import assert from 'node:assert/strict';

// The package by its own name: the entry point of package.json's "exports".
import { payitgoCheckout, PayitgoError } from '@payitgo/react';

// fakeGateway answers each request with the next answer ({status, body}, or an Error to fail the
// request) and records what was sent.
function fakeGateway(...answers) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({
      url,
      method: init.method ?? 'GET',
      contentType: init.headers?.['Content-Type'],
      body: init.body === undefined ? undefined : JSON.parse(init.body),
    });
    const answer = answers.shift() ?? { body: {} };
    if (answer instanceof Error) throw answer;
    const body = typeof answer.body === 'string' ? answer.body : JSON.stringify(answer.body);
    return new Response(body, { status: answer.status ?? 200 });
  };
  return { fetch, calls };
}

const createPayment = async () => 'b28d4f61e9a03c75d2e8f1a6';

test('reads the payer\'s view at the gateway\'s address, the checkout token escaped', async () => {
  const gw = fakeGateway({ body: { id: 'p1', status: 'pending' } });
  const adapter = payitgoCheckout({ baseUrl: 'https://gw.example/', createPayment, fetch: gw.fetch });
  const state = await adapter.get('ab/c');
  assert.deepEqual(state, { id: 'p1', status: 'pending' });
  assert.deepEqual(gw.calls, [{ url: 'https://gw.example/checkout/ab%2Fc', method: 'GET', contentType: undefined, body: undefined }]);
});

test('without baseUrl it calls the address the package was released with', async () => {
  const gw = fakeGateway({ body: {} });
  await payitgoCheckout({ createPayment, fetch: gw.fetch }).get('t');
  assert.match(gw.calls[0].url, /^https:\/\/[^/]+\/checkout\/t$/);
});

test('a gateway behind a path keeps the path', async () => {
  const gw = fakeGateway({ body: {} });
  await payitgoCheckout({ baseUrl: 'https://shop.example/payitgo//', createPayment, fetch: gw.fetch }).get('t');
  assert.equal(gw.calls[0].url, 'https://shop.example/payitgo/checkout/t');
});

test('chooseToken posts the coin; a coin chosen already reads the payment instead', async () => {
  const gw = fakeGateway(
    { body: { id: 'p1', token: 'USDT_BEP20' } },
    { status: 409, body: { error: 'the coin for this payment can no longer be changed' } },
    { body: { id: 'p1', token: 'TRX' } },
  );
  const adapter = payitgoCheckout({ baseUrl: 'https://gw.example', createPayment, fetch: gw.fetch });
  assert.equal((await adapter.chooseToken('t', 'USDT_BEP20')).token, 'USDT_BEP20');
  assert.equal((await adapter.chooseToken('t', 'BTC')).token, 'TRX');
  assert.deepEqual(gw.calls, [
    { url: 'https://gw.example/checkout/t/token', method: 'POST', contentType: 'application/json', body: { token: 'USDT_BEP20' } },
    { url: 'https://gw.example/checkout/t/token', method: 'POST', contentType: 'application/json', body: { token: 'BTC' } },
    { url: 'https://gw.example/checkout/t', method: 'GET', contentType: undefined, body: undefined },
  ]);
});

test('simulate posts the outcome', async () => {
  const gw = fakeGateway({ body: { id: 'p1', simulation: { outcome: 'paid_late', state: 'running' } } });
  const adapter = payitgoCheckout({ baseUrl: 'https://gw.example', createPayment, fetch: gw.fetch });
  assert.equal((await adapter.simulate('t', 'paid_late')).simulation.state, 'running');
  assert.deepEqual(gw.calls, [
    { url: 'https://gw.example/checkout/t/simulate', method: 'POST', contentType: 'application/json', body: { outcome: 'paid_late' } },
  ]);
});

test('errors carry the API\'s message and status', async () => {
  const gw = fakeGateway(
    { status: 404, body: { error: 'payment not found' } },
    { status: 400, body: { error: 'this payment can no longer be paid' } },
    { status: 502, body: '<html>Bad gateway</html>' },
    new TypeError('fetch failed'),
  );
  const adapter = payitgoCheckout({ baseUrl: 'https://gw.example', createPayment, fetch: gw.fetch });
  const failure = async (promise) => promise.then(() => assert.fail('expected an error'), (e) => e);

  let e = await failure(adapter.get('t'));
  assert.ok(e instanceof PayitgoError);
  assert.equal(e.name, 'PayitgoError');
  assert.equal(e.status, 404);
  assert.equal(e.message, 'Payment not found');

  e = await failure(adapter.chooseToken('t', 'BTC'));
  assert.equal(e.status, 400);
  assert.equal(e.message, 'This payment can no longer be paid');

  e = await failure(adapter.get('t'));
  assert.equal(e.status, 502);
  assert.equal(e.message, 'Request failed (502)');

  e = await failure(adapter.get('t'));
  assert.equal(e.status, 0);
  assert.match(e.message, /could not reach payitgo/i);
});

test('a rate-limited POST is sent again once, a second later', async () => {
  const gw = fakeGateway(
    { status: 429, body: { error: 'rate limit exceeded' } },
    { body: { id: 'p1', token: 'XRP', destination_tag: 7 } },
  );
  const adapter = payitgoCheckout({ baseUrl: 'https://gw.example', createPayment, fetch: gw.fetch });
  const started = Date.now();
  const state = await adapter.chooseToken('t', 'XRP');
  assert.equal(state.destination_tag, 7);
  assert.equal(gw.calls.length, 2);
  assert.ok(Date.now() - started >= 900);
});

test('start returns the checkout token createPayment resolves to, and refuses anything else', async () => {
  const seen = [];
  const payment = { title: 'Order #42', amount: { value: 49.9, currency: 'USD' } };
  const adapter = payitgoCheckout({ createPayment: async (p) => { seen.push(p); return 'b28d4f61e9a03c75d2e8f1a6'; } });
  assert.equal(await adapter.start(payment), 'b28d4f61e9a03c75d2e8f1a6');
  assert.deepEqual(seen, [payment]);

  const bad = payitgoCheckout({ createPayment: async () => ({ checkout_token: 'b28d4f61e9a03c75d2e8f1a6' }) });
  await assert.rejects(bad.start(payment), /checkout_token/);
});

test('the demo adapter changes the coin as payitgo does: a new address, the old one kept, until paid', async () => {
  const { demoAdapter } = await import('@payitgo/react');
  const cs = await demoAdapter.start({ title: 'Demo', amount: { value: 25, currency: 'USD' } });
  const first = await demoAdapter.chooseToken(cs, 'USDT_TRC20');
  assert.ok(first.token_options?.length, 'the coin can still change');
  assert.equal((await demoAdapter.chooseToken(cs, 'USDT_TRC20')).deposit_address, first.deposit_address);
  const second = await demoAdapter.chooseToken(cs, 'BTC');
  assert.equal(second.token, 'BTC');
  assert.notEqual(second.deposit_address, first.deposit_address);
  assert.deepEqual(second.previous_coins.map((c) => [c.token, c.deposit_address]), [['USDT_TRC20', first.deposit_address]]);
  demoAdapter.simulatePayment(cs);
  await new Promise((r) => setTimeout(r, 1700));
  const paid = await demoAdapter.get(cs);
  assert.equal(paid.token_options, undefined);
  assert.equal((await demoAdapter.chooseToken(cs, 'TRX')).token, 'BTC', 'a paid coin no longer changes');
});
