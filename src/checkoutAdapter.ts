import { io } from 'socket.io-client';

import type { PayitgoTokenId } from './coins.js';
import type { PayitgoAdapter, PayitgoCheckoutState, PayitgoPayment, PayitgoSimulateOutcome } from './types.js';

/** The gateway the widget calls unless `baseUrl` says otherwise: the address the package was released with */
const DEFAULT_BASE_URL = 'https://api.payitgo.co';

export interface PayitgoCheckoutOptions {
  /**
   * The payitgo gateway's address, e.g. "https://api.payitgo.co" (the default). Only its public checkout
   * routes and its socket.io server are called, and they answer any origin. A proxy in front of it must also
   * forward WebSocket upgrades on `{baseUrl}/socket.io/`.
   */
  baseUrl?: string;
  /**
   * Called when the widget opens. Ask YOUR server to create the payment with its secret key
   * (POST /v1/payments or an SDK) and return the payment's `checkout_token`, as it is: an opaque string
   * (24 hex characters today: never check its length or characters).
   * Never put a secret key in the browser.
   */
  createPayment: (payment: PayitgoPayment) => Promise<string>;
  /**
   * How often to re-read the payment, in ms, while the live connection (socket.io) is down. Default 4000.
   * While it is up the payment arrives as it changes and nothing is polled.
   */
  pollIntervalMs?: number;
  /** Custom fetch (tests, older runtimes). Defaults to the global fetch. */
  fetch?: typeof fetch;
}

/** Error thrown by the adapter: the API's message and HTTP status */
export class PayitgoError extends Error {
  /** HTTP status, or 0 when payitgo could not be reached */
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'PayitgoError';
    this.status = status;
  }
}

type SubscribeAck = { ok: true; payment: PayitgoCheckoutState } | { ok: false; error: string };

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Where socket.io connects for a gateway at `base`: its origin, on the default namespace, at the path
 * `{base's path}/socket.io/`. (Given `base` itself, socket.io would read its path as a namespace.)
 */
function socketTarget(base: string): { url: string; path: string } {
  const at = new URL(base || '/', typeof location === 'undefined' ? undefined : location.href);
  return { url: at.origin, path: `${at.pathname.replace(/\/+$/, '')}/socket.io/` };
}

/**
 * The real adapter. It calls `createPayment()` once per opening, then talks to payitgo's public
 * checkout API from the browser (no credentials; CORS-enabled):
 * - `GET  {baseUrl}/checkout/{checkout_token}`           the payer's view of the payment
 * - `POST {baseUrl}/checkout/{checkout_token}/token`     the customer's choice of coin
 * - `POST {baseUrl}/checkout/{checkout_token}/simulate`  test payments only: play an outcome
 * - socket.io at `{baseUrl}/socket.io/` (default namespace): `subscribe` with the checkout token on every
 *   connection, then a `payment:update` with the whole payment on every change. `get()` is polled only while
 *   it is down.
 */
export function payitgoCheckout(options: PayitgoCheckoutOptions): PayitgoAdapter {
  const base = (options.baseUrl ?? DEFAULT_BASE_URL).trim().replace(/\/+$/, '');

  const call = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const doFetch = options.fetch ?? fetch;
    let res: Response;
    try {
      res = await doFetch(`${base}${path}`, { ...init, cache: 'no-store' });
    } catch {
      throw new PayitgoError('Could not reach payitgo. Check your connection and try again.', 0);
    }
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message = body && typeof body.error === 'string' ? body.error : `Request failed (${res.status})`;
      throw new PayitgoError(message.charAt(0).toUpperCase() + message.slice(1), res.status);
    }
    return body as T;
  };

  // POSTs are rate limited per IP (5 a second): wait a second and retry once
  const post = async (path: string, body: unknown): Promise<PayitgoCheckoutState> => {
    const init: RequestInit = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
    try {
      return await call<PayitgoCheckoutState>(path, init);
    } catch (e) {
      if (!(e instanceof PayitgoError && e.status === 429)) throw e;
      await sleep(1000);
      return call<PayitgoCheckoutState>(path, init);
    }
  };

  return {
    pollIntervalMs: options.pollIntervalMs ?? 4000,

    async start(payment) {
      const token = await options.createPayment(payment);
      if (typeof token !== 'string' || !token.trim()) {
        throw new PayitgoError('createPayment must resolve to the payment\'s checkout_token.', 0);
      }
      return token;
    },

    get(checkoutToken) {
      return call<PayitgoCheckoutState>(`/checkout/${encodeURIComponent(checkoutToken)}`);
    },

    async chooseToken(checkoutToken, token: PayitgoTokenId) {
      try {
        return await post(`/checkout/${encodeURIComponent(checkoutToken)}/token`, { token });
      } catch (e) {
        // Already chosen (another tab, or a retried click): carry on with the payment as it is
        if (e instanceof PayitgoError && e.status === 409) return call<PayitgoCheckoutState>(`/checkout/${encodeURIComponent(checkoutToken)}`);
        throw e;
      }
    },

    simulate(checkoutToken, outcome: PayitgoSimulateOutcome) {
      return post(`/checkout/${encodeURIComponent(checkoutToken)}/simulate`, { outcome });
    },

    subscribe(checkoutToken, { onPayment, onConnection, onNotFound }) {
      // The gateway itself. No `transports` option: WebSocket where it works, long-polling on the same
      // /socket.io/ path where WebSockets are blocked
      const { url, path } = socketTarget(base);
      const socket = io(url, { path });
      let over = false;
      const notFound = (message: string) => {
        if (over) return;
        over = true;
        socket.disconnect(); // the server ends the socket too: never reconnect for a bad token
        onNotFound?.(message.charAt(0).toUpperCase() + message.slice(1));
      };
      // updates counts the payment:update events, so an acknowledgement can tell whether one came in
      // after it was asked for
      let updates = 0;
      // On every (re)connection: idempotent, and brings a fresh snapshot
      // Live only once the subscription is acknowledged: until then the widget keeps polling
      socket.on('connect', async () => {
        const before = updates;
        try {
          const ack = (await socket.timeout(10_000).emitWithAck('subscribe', checkoutToken)) as SubscribeAck;
          if (over) return;
          if (ack.ok) {
            onConnection?.(true);
            // The gateway sends the payment.snapshot event just before acknowledging, and an update can
            // follow at once: any event since subscribing is at least as new as the acknowledgement's
            // payment, which then must not overwrite it
            if (updates === before) onPayment(ack.payment, 'payment.snapshot');
          } else notFound(ack.error);
        } catch { /* no acknowledgement in time: the payment.snapshot event, or polling, fills in */ }
      });
      socket.on('payment:update', (e: { type: string; payment?: PayitgoCheckoutState }) => {
        if (over || !e?.payment) return;
        updates++;
        onConnection?.(true);
        onPayment(e.payment, e.type);
      });
      socket.on('error', (message: unknown) => {
        if (message === 'payment not found' || message === 'checkout token required') notFound(message);
      });
      socket.on('connect_error', () => { if (!over) onConnection?.(false); });
      socket.on('disconnect', () => { if (!over) onConnection?.(false); });
      return () => {
        over = true;
        socket.disconnect();
      };
    },
  };
}
