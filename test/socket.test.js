import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Server } from 'socket.io';

import { payitgoCheckout } from '@payitgo/react';

// gateway is a socket.io server whose default namespace answers like payitgo's: `subscribe` with a
// checkout token joins the payment's room, sends a payment.snapshot and acknowledges with the payment;
// an unknown token is acknowledged {ok: false}, then an `error` event, then a server disconnect.
async function gateway(path, payments) {
  const http = createServer();
  const io = new Server(http, { path, cors: { origin: '*' } });
  const seen = { connections: 0 };
  io.on('connection', (socket) => {
    seen.connections++;
    socket.on('subscribe', (token, ack) => {
      const payment = payments[token];
      if (!payment) {
        ack?.({ ok: false, error: 'payment not found' });
        socket.emit('error', 'payment not found');
        socket.disconnect(false);
        return;
      }
      socket.join(payment.id);
      socket.emit('payment:update', { type: 'payment.snapshot', payment, id: payment.id, status: payment.status });
      ack?.({ ok: true, payment });
    });
  });
  await new Promise((resolve) => http.listen(0, '127.0.0.1', resolve));
  return {
    io,
    seen,
    url: `http://127.0.0.1:${http.address().port}`,
    close: () => new Promise((resolve) => io.close(() => resolve())),
  };
}

// until resolves once check() is true, polling every 20 ms for at most 5 s.
async function until(check) {
  for (let i = 0; i < 250 && !check(); i++) await new Promise((r) => setTimeout(r, 20));
  assert.ok(check(), 'timed out');
}

const pending = { id: 'p1', order_id: 'ORD-1', status: 'pending', token: 'USDT_TRC20', crypto_amount: '20', received_amount: '0' };
const createPayment = async () => 'tok1';

for (const [name, path, suffix] of [
  ['at the gateway\'s root', '/socket.io/', ''],
  ['behind a path, on the default namespace', '/payitgo/socket.io/', '/payitgo'],
]) {
  test(`follows the payment live ${name}`, async (t) => {
    const gw = await gateway(path, { tok1: pending });
    t.after(gw.close);
    const events = [];
    const connection = [];
    const adapter = payitgoCheckout({ baseUrl: gw.url + suffix, createPayment });
    const stop = adapter.subscribe('tok1', {
      onPayment: (payment, type) => events.push({ type, status: payment.status }),
      onConnection: (up) => connection.push(up),
      onNotFound: () => assert.fail('the token is known'),
    });
    t.after(stop);

    await until(() => connection.includes(true) && events.some((e) => e.type === 'payment.snapshot'));
    gw.io.to('p1').emit('payment:update', { type: 'payment.detecting', payment: { ...pending, status: 'detecting', received_amount: '20' } });
    await until(() => events.some((e) => e.type === 'payment.detecting'));
    assert.deepEqual(events.at(-1), { type: 'payment.detecting', status: 'detecting' });

    // An event without its payment is not rendered.
    gw.io.to('p1').emit('payment:update', { type: 'payment.confirmations', id: 'p1' });
    await new Promise((r) => setTimeout(r, 100));
    assert.ok(events.every((e) => e.status));

    stop();
    await until(() => gw.io.of('/').sockets.size === 0);
  });
}

test('an unknown checkout token ends the subscription: no payment, no reconnect', async (t) => {
  const gw = await gateway('/socket.io/', {});
  t.after(gw.close);
  const notFound = [];
  const payments = [];
  const adapter = payitgoCheckout({ baseUrl: gw.url, createPayment });
  const stop = adapter.subscribe('nope', {
    onPayment: (p) => payments.push(p),
    onNotFound: (message) => notFound.push(message),
  });
  t.after(stop);

  await until(() => notFound.length > 0);
  // socket.io-client would reconnect within 1.5 s if it were going to.
  await new Promise((r) => setTimeout(r, 1600));
  assert.deepEqual(notFound, ['Payment not found']);
  assert.deepEqual(payments, []);
  assert.equal(gw.seen.connections, 1);
});
