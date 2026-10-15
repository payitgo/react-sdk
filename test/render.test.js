import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import * as pkg from '@payitgo/react';
import { subtractDecimal, formatPrice } from '../dist/coins.js';
import { sortOptions } from '../dist/price.js';
import { PayScreen } from '../dist/screens/PayScreen.js';
import { SelectScreen } from '../dist/screens/SelectScreen.js';
import { SimulatePanel } from '../dist/screens/SimulatePanel.js';
import { ExpiredScreen, UnderpaidScreen } from '../dist/screens/StatusScreens.js';

const inTen = () => new Date(Date.now() + 10 * 60 * 1000).toISOString();

// Payments as GET /checkout/{token} returns them (the fields the widget reads).
const base = {
  id: '8f3a2c1e9b7d4a6f05e1c2d3', order_id: 'ORD-1001', status: 'pending', livemode: false,
  received_amount: '0', usd_amount: '49.9', amount_due_usd: '49.9', fees_paid_by_customer: false,
  network_fee_note: '', confirmations: 0, confirmations_required: 0, deposits: [], expires_at: inTen(),
};
const xrp = {
  ...base, token: 'XRP', chain: 'xrp', network: 'XRP Ledger', deposit_address: 'rfKmw7L3cbff2haTX1sfR6ZF8AgEZPy7oy',
  destination_tag: 1, qr_payload: 'rfKmw7L3cbff2haTX1sfR6ZF8AgEZPy7oy', crypto_amount: '14.215246',
  network_fee_note: 'Final in seconds. Include the destination tag: it is required.', confirmations_required: 1,
};
const usdt = {
  ...base, token: 'USDT_TRC20', chain: 'tron', network: 'Tron (TRC-20)', deposit_address: 'TNVfZ8m3qR6xW2pL9kC4hJ7bD5sYt1uAeG',
  qr_payload: 'TNVfZ8m3qR6xW2pL9kC4hJ7bD5sYt1uAeG', crypto_amount: '49.9', confirmations_required: 20,
};
const choosing = {
  ...base, token: '', chain: '', deposit_address: '', qr_payload: '', crypto_amount: '0', usd_amount: '40',
  amount_due_usd: '40', fees_paid_by_customer: true,
  token_options: [
    { token: 'USDT_TRC20', chain: 'tron', network: 'Tron (TRC-20)', min_usd: '1', network_fee_usd: '6.04', amount_due_usd: '46.42', fee_note: 'Final in about a minute.' },
    { token: 'USDT_BEP20', chain: 'bsc', network: 'BNB Smart Chain (BEP-20)', min_usd: '1', network_fee_usd: '0.01', amount_due_usd: '40.34', fee_note: 'Final in under a minute.' },
    { token: 'BTC', chain: 'bitcoin', network: 'Bitcoin', min_usd: '10', network_fee_usd: '0.21', amount_due_usd: '40.54', fee_note: 'Final in about 30 minutes (3 confirmations).' },
  ],
};

const render = (component, props) => renderToStaticMarkup(h(component, props));
// buttons maps each button's label to whether it is enabled.
const buttons = (html) => Object.fromEntries([...html.matchAll(/<button([^>]*)>([^<]*)<\/button>/g)].map(([, attrs, label]) => [label, !/ disabled=""/.test(attrs)]));

test('the package exports the widget, the adapters and the coins', () => {
  for (const name of ['PayitgoCheckout', 'PayitgoButton', 'payitgoCheckout', 'PayitgoError', 'demoAdapter', 'coinFor']) {
    assert.equal(typeof pkg[name], name === 'demoAdapter' ? 'object' : 'function', name);
  }
  assert.equal(pkg.COINS.length, 12);
  assert.equal(pkg.CHAIN_NAMES.xrp, 'XRP Ledger');
});

test('the dialog renders nothing on the server', () => {
  const html = render(pkg.PayitgoCheckout, { open: true, onClose() {}, payment: { title: 'Order', amount: { value: 1, currency: 'USD' } } });
  assert.equal(html, '');
});

test('an XRP payment shows its destination tag, marked required, next to the address and amount', () => {
  const html = render(PayScreen, { state: xrp, remainingMs: 600_000, titleId: 't' });
  assert.match(html, /Destination tag<span class="payitgo-required">Required<\/span>/);
  assert.match(html, /<span class="payitgo-field-value">1<\/span>/);
  assert.match(html, /rfKmw7L3cbff2haTX1sfR6ZF8AgEZPy7oy/);
  assert.match(html, /14\.215246 XRP/);
  assert.match(html, /on XRP Ledger/);
  assert.match(html, /<svg/); // the QR code
  assert.doesNotMatch(render(PayScreen, { state: usdt, remainingMs: 600_000, titleId: 't' }), /Destination tag/);
});

test('a partly paid payment asks for the rest, to the same address', () => {
  const html = render(PayScreen, { state: { ...usdt, status: 'partially_paid', received_amount: '30' }, remainingMs: 600_000, titleId: 't' });
  assert.match(html, /Send the rest/);
  assert.match(html, /We received <strong>30 of 49\.9 USDT<\/strong>/);
  assert.match(html, /19\.9 USDT/);
});

test('with the fees passed on, the coins are listed cheapest first, each at its own price', () => {
  const options = sortOptions(choosing.token_options);
  assert.deepEqual(options.map((o) => o.token), ['USDT_BEP20', 'BTC', 'USDT_TRC20']);
  const html = render(SelectScreen, {
    payment: { title: 'Order #42', amount: { value: 40, currency: 'USD' } }, state: choosing, selected: options[0].token,
    onSelect() {}, onCancel() {}, onPay() {}, busy: false, error: '', remainingMs: 3_000_000, titleId: 't',
  });
  const at = (s) => html.indexOf(s);
  assert.ok(at('BNB Smart Chain (BEP-20)') < at('Bitcoin') && at('Bitcoin') < at('Tron (TRC-20)'));
  assert.match(html, /\$46\.42 with fees/);
  assert.equal(buttons(html)['Pay $40.34'], true);
});

test('the simulate buttons: never on a live payment, only "Let it expire" before the coin, no other coin on Bitcoin', () => {
  const props = (state) => ({ state, simulate: async () => state, onState() {}, onReload() {} });
  assert.equal(render(SimulatePanel, props({ ...usdt, livemode: true })), '');

  let b = buttons(render(SimulatePanel, props(choosing)));
  assert.deepEqual(Object.keys(b).filter((k) => b[k]), ['Let it expire']);

  b = buttons(render(SimulatePanel, props({ ...usdt, chain: 'bitcoin', token: 'BTC' })));
  assert.equal(b['Pay in another coin'], false);
  assert.equal(b['Pay in full'], true);

  b = buttons(render(SimulatePanel, props({ ...usdt, simulation: { outcome: 'confirmed', state: 'running' } })));
  assert.ok(Object.values(b).every((enabled) => !enabled));

  b = buttons(render(SimulatePanel, props({ ...usdt, status: 'detecting' })));
  assert.ok(Object.values(b).every((enabled) => !enabled));
});

test('an expired payment offers a new one only when nothing can still complete it', () => {
  const props = (state) => ({ state, onRestart() {}, onClose() {}, titleId: 't' });
  assert.equal(buttons(render(ExpiredScreen, props({ ...choosing, status: 'expired' })))['Start again'], true);
  // An address was shown: the customer is asked first.
  assert.equal(buttons(render(ExpiredScreen, props({ ...usdt, status: 'expired' })))['Start a new payment'], true);
  const paid = { ...usdt, status: 'expired', deposits: [{ tx_id: 'a'.repeat(64), token: 'USDT_TRC20', amount: '49.9', counted: true, status: 'pending', late: true }] };
  const b = buttons(render(ExpiredScreen, props(paid)));
  assert.equal(b['Start again'] ?? b['Start a new payment'], undefined);
});

test('an underpaid payment says what arrived', () => {
  const html = render(UnderpaidScreen, { state: { ...usdt, status: 'underpaid', received_amount: '30' }, onClose() {}, titleId: 't' });
  assert.match(html, /Only 30 of 49\.9 USDT arrived/);
  assert.match(html, /ORD-1001/);
});

test('amounts are exact decimal strings', () => {
  assert.equal(subtractDecimal('49.9', '30'), '19.9');
  assert.equal(subtractDecimal('0.00012', '0.00002'), '0.0001');
  assert.equal(subtractDecimal('14.215246', '14.215246'), '0');
  assert.equal(subtractDecimal('1', '2'), '0');
  assert.match(formatPrice('45.50', 'EUR'), /45\.50/);
  assert.equal(formatPrice(undefined, undefined), '');
});
