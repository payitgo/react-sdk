import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import * as pkg from '@payitgo/react';
import { subtractDecimal, formatMoney } from '../dist/coins.js';
import { sortOptions } from '../dist/price.js';
import { PayScreen } from '../dist/screens/PayScreen.js';
import { SelectScreen } from '../dist/screens/SelectScreen.js';
import { SimulatePanel } from '../dist/screens/SimulatePanel.js';
import { ExpiredScreen, LoadingScreen, PaidScreen, UnderpaidScreen } from '../dist/screens/StatusScreens.js';

const inTen = () => new Date(Date.now() + 10 * 60 * 1000).toISOString();

// Payments as GET /checkout/{token} returns them (the fields the widget reads).
const base = {
  id: '8f3a2c1e9b7d4a6f05e1c2d3', order_id: 'ORD-1001', status: 'pending', livemode: false,
  crypto_received: '0', currency: 'USD', amount: '49.9', amount_due: '49.9', fees_paid_by_customer: false,
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
  ...base, token: '', chain: '', deposit_address: '', qr_payload: '', crypto_amount: '0', amount: '40',
  amount_due: '40', fees_paid_by_customer: true,
  token_options: [
    { token: 'USDT_TRC20', chain: 'tron', network: 'Tron (TRC-20)', minimum: '1', network_fee: '6.04', amount_due: '46.42', fee_note: 'Final in about a minute.' },
    { token: 'USDT_BEP20', chain: 'bsc', network: 'BNB Smart Chain (BEP-20)', minimum: '1', network_fee: '0.01', amount_due: '40.34', fee_note: 'Final in under a minute.' },
    { token: 'BTC', chain: 'bitcoin', network: 'Bitcoin', minimum: '10', network_fee: '0.21', amount_due: '40.54', fee_note: 'Final in about 30 minutes (3 confirmations).' },
  ],
};

const render = (component, props) => renderToStaticMarkup(h(component, props));
// buttons maps each button's label to whether it is enabled.
const buttons = (html) => Object.fromEntries([...html.matchAll(/<button([^>]*)>([^<]*)<\/button>/g)].map(([, attrs, label]) => [label, !/ disabled=""/.test(attrs)]));

test('the package exports the widget, the adapters and the coins', () => {
  for (const name of ['PayitgoCheckout', 'PayitgoButton', 'payitgoCheckout', 'PayitgoError', 'demoAdapter', 'coinFor']) {
    assert.equal(typeof pkg[name], name === 'demoAdapter' ? 'object' : 'function', name);
  }
  assert.equal(pkg.COINS.length, 16);
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
  const html = render(PayScreen, { state: { ...usdt, status: 'partially_paid', crypto_received: '30' }, remainingMs: 600_000, titleId: 't' });
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

test('the gateway names and draws a coin; one it does not describe is drawn from the bundled list', () => {
  const shib = {
    ...base, token: 'SHIB_ERC20', chain: 'ethereum', network: 'Ethereum (ERC-20)', token_ticker: 'SHIB',
    token_icon_url: 'https://api.payitgo.co/coins/SHIB_ERC20.svg', deposit_address: '0x1111111111111111111111111111111111111111',
    qr_payload: '0x1111111111111111111111111111111111111111', crypto_amount: '10040160.642570281124497992', confirmations_required: 12,
  };
  const html = render(PayScreen, { state: shib, remainingMs: 600_000, titleId: 't' });
  assert.match(html, /<img alt="" src="https:\/\/api\.payitgo\.co\/coins\/SHIB_ERC20\.svg"/);
  assert.match(html, /10040160\.642570281124497992 SHIB/);
  assert.match(html, /Send only <strong>SHIB<\/strong> on <strong>Ethereum \(ERC-20\)<\/strong>/);
  // A coin newer than this package, named by the gateway alone
  const newer = { ...shib, token: 'NEW_ERC20', token_ticker: 'NEWT', token_icon_url: 'https://api.payitgo.co/coins/NEW_ERC20.svg' };
  assert.match(render(PayScreen, { state: newer, remainingMs: 600_000, titleId: 't' }), /Send NEWT/);
  // An older gateway's payment, without them: the bundled list
  const plain = render(PayScreen, { state: usdt, remainingMs: 600_000, titleId: 't' });
  assert.doesNotMatch(plain, /<img/);
  assert.match(plain, /Send USDT/);
  const options = [{ ...choosing.token_options[1], name: 'Tether', ticker: 'USDT', icon_url: 'https://api.payitgo.co/coins/USDT_BEP20.svg' }];
  const select = render(SelectScreen, {
    payment: { title: 'Order #42', amount: { value: 40, currency: 'USD' } }, state: { ...choosing, token_options: options }, selected: '',
    onSelect() {}, onCancel() {}, onPay() {}, busy: false, error: '', remainingMs: 3_000_000, titleId: 't',
  });
  assert.match(select, /src="https:\/\/api\.payitgo\.co\/coins\/USDT_BEP20\.svg"/);
  assert.match(select, /Tether <span class="payitgo-muted" style="font-weight:400">USDT<\/span>/);
});

test('a chosen coin offers "Change coin" exactly while payitgo still offers the coins', () => {
  const changeable = { ...usdt, token_options: choosing.token_options };
  assert.match(render(PayScreen, { state: changeable, remainingMs: 600_000, onChangeCoin() {}, titleId: 't' }), />Change coin</);
  assert.doesNotMatch(render(PayScreen, { state: usdt, remainingMs: 600_000, titleId: 't' }), /Change coin/);
  const refused = render(PayScreen, { state: usdt, remainingMs: 600_000, notice: 'The coin can no longer be changed for this payment.', titleId: 't' });
  assert.match(refused, /can no longer be changed/);

  // The picker again: back to the coin chosen, and keeping it changes nothing
  const picker = (selected) => render(SelectScreen, {
    payment: { title: 'Order #42', amount: { value: 40, currency: 'USD' } }, state: { ...changeable, fees_paid_by_customer: true },
    changing: true, selected, onSelect() {}, onCancel() {}, onPay() {}, busy: false, error: '', remainingMs: 600_000, titleId: 't',
  });
  assert.equal(buttons(picker('USDT_TRC20'))['Back'], true);
  assert.equal(buttons(picker('USDT_TRC20'))['Keep this coin'], true);
  assert.match(picker('BTC'), /instead, at a new address/);
  assert.equal(buttons(picker('BTC'))['Pay $40.54'], true);
});

test('the simulate buttons: never on a live payment, all but another coin before the coin (they wait for it), no other coin on Bitcoin', () => {
  const props = (state) => ({ state, simulate: async () => state, onState() {}, onReload() {} });
  assert.equal(render(SimulatePanel, props({ ...usdt, livemode: true })), '');

  const before = render(SimulatePanel, props(choosing));
  let b = buttons(before);
  assert.deepEqual(Object.keys(b).filter((k) => !b[k]), ['Pay in another coin']);
  assert.match(before, /No coin chosen yet/);
  // Asked for already: it says so instead
  const requested = render(SimulatePanel, props({ ...choosing, simulation: { outcome: 'confirmed', state: 'requested' } }));
  assert.match(requested, /once a coin is chosen/);
  assert.doesNotMatch(requested, /No coin chosen yet/);

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
  const html = render(UnderpaidScreen, { state: { ...usdt, status: 'underpaid', crypto_received: '30' }, onClose() {}, titleId: 't' });
  assert.match(html, /Only 30 of 49\.9 USDT arrived/);
  assert.match(html, /ORD-1001/);
});

test('amounts are exact decimal strings', () => {
  assert.equal(subtractDecimal('49.9', '30'), '19.9');
  assert.equal(subtractDecimal('0.00012', '0.00002'), '0.0001');
  assert.equal(subtractDecimal('14.215246', '14.215246'), '0');
  assert.equal(subtractDecimal('1', '2'), '0');
});

test('money is shown in the payment\'s currency: dollars with a sign, another currency with its code, a coin as given', () => {
  assert.equal(formatMoney('12.5', 'USD'), '$12.50');
  assert.equal(formatMoney(49.9, undefined), '$49.90');
  assert.equal(formatMoney('45.5', 'EUR'), '45.50 EUR');
  assert.equal(formatMoney('1234.5', 'ngn'), '1,234.50 NGN');
  assert.equal(formatMoney('0.5', 'ETH'), '0.5 ETH');
  assert.equal(formatMoney('0.00012345', 'BTC'), '0.00012345 BTC');
  assert.equal(formatMoney('20', 'USDT_TRC20'), '20 USDT');
  assert.equal(formatMoney(undefined, 'EUR'), '0.00 EUR');
});

test('a payment priced in another currency, or in a coin, shows every figure in it and never in dollars', () => {
  const props = (state, selected) => ({
    payment: { title: 'Order #42', amount: { value: 40, currency: state.currency } }, state, selected,
    onSelect() {}, onCancel() {}, onPay() {}, busy: false, error: '', remainingMs: 3_000_000, titleId: 't',
  });
  let html = render(SelectScreen, props({ ...choosing, currency: 'EUR' }, 'USDT_BEP20'));
  assert.match(html, /40\.00 EUR/);
  assert.match(html, /You pay ≈ 40\.34 EUR with fees in USDT/);
  assert.match(html, /46\.42 EUR with fees/);
  assert.equal(buttons(html)['Pay 40.34 EUR'], true);
  assert.doesNotMatch(html, /\$/);
  // A payment link priced in a coin: the amount as the gateway gives it, then the coin
  const ether = { ...choosing, currency: 'ETH', amount: '0.5', amount_due: '0.5', fees_paid_by_customer: false, token_options: choosing.token_options.map((o) => ({ ...o, amount_due: undefined })) };
  html = render(SelectScreen, props(ether, 'ETH'));
  assert.match(html, /0\.5 ETH/);
  assert.equal(buttons(html)['Pay 0.5 ETH'], true);
  assert.doesNotMatch(html, /\$/);
  // The pay screen and the paid summary: what the coins are worth, in the payment's currency
  const euros = { ...usdt, currency: 'EUR', amount: '45.5', amount_due: '45.5' };
  assert.match(render(PayScreen, { state: euros, remainingMs: 600_000, titleId: 't' }), /≈ 45\.50 EUR/);
  const paid = render(PaidScreen, { payment: props(euros, '').payment, state: { ...euros, status: 'confirmed', crypto_received: '49.9', amount_received: '45.5' }, onDone() {}, titleId: 't' });
  assert.match(paid, /45\.50 EUR/);
  assert.doesNotMatch(paid, /\$/);
  assert.match(render(LoadingScreen, { payment: { title: 'Order #42', amount: { value: '45.50', currency: 'EUR' } }, titleId: 't' }), /45\.50 EUR/);
});
