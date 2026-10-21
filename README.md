# payitgo for React

A crypto checkout widget for React apps, for [payitgo](https://api.payitgo.co/docs): a button that opens a
checkout modal on your own page, where the customer chooses a coin, sees the exact amount, network, QR code,
address (and XRP destination tag), pays from their wallet, and watches the payment confirm.

Full reference: [api.payitgo.co/docs/sdk-react](https://api.payitgo.co/docs/sdk-react).

## Install

```sh
npm install @payitgo/react
```

Peer dependencies: `react` and `react-dom` 18 or 19. It depends on `qrcode.react` and `socket.io-client`.

The package is ESM and its components are marked `'use client'`. In the Next.js App Router, render them from a
client component: the adapter and `onSuccess` are functions, which a server component cannot pass down.

## Usage

The widget needs no key. Your server creates the payment with its secret key and hands the browser the
payment's `checkout_token`; the widget does the rest.

```tsx
import { PayitgoButton, payitgoCheckout } from '@payitgo/react';

const adapter = payitgoCheckout({
  // Ask your server for the payment and return its checkout_token. Never put a secret key in the browser.
  createPayment: async () =>
    (await fetch('/orders/42/payitgo', { method: 'POST' }).then(r => r.json())).checkout_token,
});

export function PayButton() {
  return (
    <PayitgoButton
      adapter={adapter}
      payment={{ title: 'Order #42', amount: { value: 49.9, currency: 'USD' } }}
      onSuccess={(result) => {
        // result: { paymentId, status: 'confirmed', token, amount, txId }
        // Not proof of payment: fulfil the order from the payment.confirmed webhook.
      }}
    >
      Pay with crypto
    </PayitgoButton>
  );
}
```

Your server endpoint (`/orders/42/payitgo` above) creates the payment and returns its `checkout_token`. With
the Node.js library, [`@payitgo/node`](https://www.npmjs.com/package/@payitgo/node) (any payitgo library, or
`POST /v1/payments`, does the same):

```ts
import { Payitgo } from '@payitgo/node';

const payitgo = new Payitgo(process.env.PAYITGO_KEY!); // your secret key, on the server only

app.post('/orders/:id/payitgo', async (req, res) => {
  const order = await orders.get(req.params.id);
  // No token: the customer picks the coin in the widget.
  const payment = await payitgo.payments.create({ order_id: order.id, amount_usd: order.total });
  res.json({ checkout_token: payment.checkout_token });
});
```

Creating it again for the same `order_id` while it is open returns the same payment, so reopening the widget
shows the same address and amount.

`baseUrl` is the gateway's address, `https://api.payitgo.co` unless you pass another:
`payitgoCheckout({ baseUrl, createPayment })`.

### No server: a payment link

A [payment link](https://api.payitgo.co/docs/checkout#payment-links-in-email-or-chat) needs no key to pay, so
a page with no server of its own can start its payment from the browser:

```ts
const adapter = payitgoCheckout({
  createPayment: async () => {
    const r = await fetch(`https://api.payitgo.co/links/${linkId}/checkout`, { method: 'POST' });
    const body = await r.json();
    if (!r.ok) throw new Error(body.error); // e.g. "this payment link can no longer be paid"
    return body.checkout_token;
  },
});
```

### What the widget does

1. When it opens, it calls `createPayment()` once and reads `GET {baseUrl}/checkout/{checkout_token}`.
2. If the payment has no coin yet, it lists the payment's `token_options` (each with its price and
   `fee_note`; when you pass the fees on, each with its own `amount_due_usd`, cheapest first) and posts the
   customer's choice to `POST {baseUrl}/checkout/{checkout_token}/token`. If that coin is no longer offered,
   it reloads the payment and asks again; if the time to choose has passed ("this payment can no longer be
   paid"), it shows the expired view. While the chosen coin can still change (the payment still has
   `token_options`: nothing has arrived, three changes at most), the pay screen has a **Change coin** button
   that reopens the list; another coin gets a new address, amount and 15 minutes.
3. It shows the exact amount and network, the QR code (`qr_payload`: the address only, so the amount and
   any XRP destination tag are shown as text to copy), the address, the XRP destination tag (marked
   required) and a countdown to `expires_at`. At zero it shows "Time is up, checking…" and waits for the
   gateway to close the payment rather than deciding on its own. A payment priced in another currency
   (`price_amount`, `price_currency`) shows that price next to the dollars: "€45.50 · ≈ $49.23", or
   "Price €45.50 · you pay ≈ $50.40" when the fees are passed on. Every transfer in `deposits[]` is listed
   with its own confirmations, and marked "Not counted" (another coin) or "Late" (after the deadline).
4. It follows the payment **live** over socket.io: it connects to the gateway's default namespace at
   `{baseUrl}/socket.io/` (WebSocket, falling back to long-polling on the same path where WebSockets are
   blocked), emits `subscribe` with the checkout token on every connection and renders the whole payment
   carried by each `payment:update`: `pending`, `partially_paid` (what arrived and what is still missing),
   `detecting` (confirmations), `confirmed`, `expired`, `underpaid`, `failed`. It keeps listening after
   `expired` and `underpaid` (a late payment can still complete them within 24 hours) and disconnects at
   `confirmed` and `failed`. While the socket is down it polls `GET /checkout/{checkout_token}` every
   `pollIntervalMs` instead (the connection counts as live only once `subscribe` is acknowledged).
   An unknown checkout token ("payment not found") shows a "Payment not found" screen: no reconnect, no
   retry, and no new payment is created.
5. When the payment is confirmed it calls `onSuccess` once.
6. When the payment expires it does not throw it away: money that arrives within 24 hours can still complete
   it, so the widget keeps following it. "Start again" (a new payment through `createPayment()`) is offered
   straight away only if no coin was chosen; once an address was shown the customer must first confirm they
   sent nothing, and once anything arrived it is not offered. The underpaid view says the same about
   sending the rest late.

Every route the widget calls (`GET /checkout/{token}`, `POST /checkout/{token}/token`,
`POST /checkout/{token}/simulate` and `/socket.io/`) answers any origin (`Access-Control-Allow-Origin: *`), so
the widget calls the gateway directly from your page: no proxy is needed. If you put one in front of it anyway
(`baseUrl: 'https://yourdomain.com/payitgo'`), it must forward WebSocket upgrades on `/payitgo/socket.io/`: a
plain HTTP rewrite cannot carry the WebSocket.

### Test payments: simulate an outcome

A test payment (created with a test key) moves no coins: nothing watches its address. For those
the widget shows simulate buttons under the "Test payment" banner, never on a live payment. Each plays what
the customer does through the real processing (`POST {baseUrl}/checkout/{checkout_token}/simulate`), and the
result arrives on the socket like real coins would, your webhooks included:

| Button | Outcome |
|---|---|
| Pay in full | `confirmed` |
| Overpay | `confirmed` with `overpaid: true` |
| Pay half | `partially_paid`; the payment stays open |
| Underpay | `partially_paid`, then `underpaid` |
| Let it expire | `expired` (the only one before a coin is chosen) |
| Drop the transaction | `detecting`, then `failed` |
| Pay in another coin | a deposit in another coin (not on Bitcoin, Litecoin, Dogecoin or XRP) |
| Pay late | `partially_paid`, `underpaid`, then `confirmed` with `paid_late: true` |

The buttons are disabled while a simulation runs and once the payment is confirming or closed.

`onSuccess` runs in the customer's browser and is **not proof of payment**. Fulfil orders from the
`payment.confirmed` webhook on your server.

### Props

`<PayitgoButton>` takes every `<PayitgoCheckout>` prop except `open`, plus `children`, `className`, `style`,
`disabled` and `onClose`. `<PayitgoCheckout open onClose …>` is the controlled modal.

| Prop | Type | |
|---|---|---|
| `adapter` | `PayitgoAdapter` | `payitgoCheckout({...})` for real payments; defaults to `demoAdapter` |
| `payment` | `{ title, amount: { value, currency: 'USD' }, description?, period?, badge?, lineItem?, due? }` | Display text. The amount shown once loaded is the payment's own: `amount_due_usd`, with `price_amount` / `price_currency` beside it when your server priced the payment in another currency |
| `theme` | `{ mode?: 'dark' \| 'light', accent?: string }` | |
| `onSuccess` | `(result: PayitgoResult) => void` | `{ paymentId, status: 'confirmed', token, amount, txId }`; `amount` is a decimal string in `token` |
| `returnLinks` | `boolean` (default `false`) | Show the payment's `success_url` ("Back to the shop" once paid) and `cancel_url` (when it expires, is underpaid or fails) as links. Off by default: the widget usually sits on the shop's own page, where closing it is the way back |

`payitgoCheckout(options)`: `createPayment(payment) => Promise<checkout_token>`, and optionally `baseUrl`
(default `https://api.payitgo.co`), `pollIntervalMs` (default 4000; used only while the live connection is
down) and `fetch`. Its errors are `PayitgoError`s, with the API's message and HTTP `status` (0 when the gateway
could not be reached).

### Custom adapters

A `PayitgoAdapter` needs `start`, `get` and `chooseToken`. Two optional methods turn on more:
`subscribe(checkoutToken, { onPayment, onConnection, onNotFound })` (returns an unsubscribe function) follows
the payment live, and `simulate(checkoutToken, outcome)` shows the simulate buttons on test payments.
Without `subscribe`, the widget polls `get()` every `pollIntervalMs`.

### Demo mode

`demoAdapter` simulates everything offline (every coin, fake addresses that no wallet accepts, and a
"Simulate payment" button). Use it for previews and design work; it never touches the network.

### Content Security Policy

The widget adds one `<style>` element to the page the first time it opens. A policy that limits `style-src`
must allow inline styles (`'unsafe-inline'`), and `connect-src` must allow the gateway (`https:` and `wss:`).
`img-src` should allow it too: the coin icons are the gateway's (`icon_url`). A blocked icon falls back to the
one the widget draws itself.

## Developing this package

```sh
npm install     # also builds dist/
npm run typecheck
npm test        # builds, then runs test/ with node --test
npm pack        # writes payitgo-react-<version>.tgz
```

A local tarball installs like the published package: `npm install ./payitgo-react-<version>.tgz`.

## License

MIT
