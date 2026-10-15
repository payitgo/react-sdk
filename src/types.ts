import type { PayitgoChain, PayitgoTokenId } from './coins.js';

/**
 * What the customer is paying for, as the widget shows it. Your server decides the real amount when it
 * creates the payment (POST /v1/payments): once the payment is loaded, the widget shows the payment's own
 * amount. Everything except `title` and `amount` is optional display text.
 */
export interface PayitgoPayment {
  title: string;
  /** The price. Only US dollars are supported as the display currency. */
  amount: { value: number | string; currency: 'USD' };
  /** Line under the title */
  description?: string;
  /** Small pill next to the title, e.g. "October 2026" */
  period?: string;
  /** Uppercase tag next to the title, e.g. "PREVIEW" */
  badge?: string;
  /** Line under the amount, e.g. "Market data feed · October 2026" */
  lineItem?: string;
  /** Shown as "Due on …" */
  due?: string;
}

export interface PayitgoTheme {
  /** Accent colour for buttons and the selected coin. Defaults to payitgo purple. */
  accent?: string;
  mode?: 'dark' | 'light';
}

export type PayitgoStatus = 'pending' | 'partially_paid' | 'detecting' | 'confirmed' | 'expired' | 'underpaid' | 'failed';

/** One coin the customer may choose (a TokenInfo from the payment's token_options) */
export interface PayitgoTokenOption {
  token: PayitgoTokenId;
  chain: PayitgoChain;
  name?: string;
  network?: string;
  confirmations?: number;
  min_usd: string;
  network_fee_usd: string;
  /** For a coin that is converted: the share of the payment the network fee adds on top, in basis points (180: 1.8%) */
  network_fee_bps?: number;
  /** Present when the merchant passes fees on: what the customer pays in this coin */
  amount_due_usd?: string;
  fee_note?: string;
}

/** A test payment's simulated outcome: what the "customer" does (no coins move) */
export type PayitgoSimulateOutcome =
  | 'confirmed' | 'overpaid' | 'partially_paid' | 'underpaid' | 'expired' | 'failed' | 'wrong_asset' | 'paid_late';

/** Test payments only, once an outcome was asked for */
export interface PayitgoSimulation {
  outcome: PayitgoSimulateOutcome;
  /** `requested`: starts by itself once the coin is chosen. `running`: in progress. `done`: another can run */
  state: 'requested' | 'running' | 'done';
}

/** One transfer to the payment */
export interface PayitgoDeposit {
  tx_id: string;
  token: string;
  amount: string;
  /** false: another coin than the payment asked for, which does not count */
  counted: boolean;
  confirmations?: number;
  confirmations_required?: number;
  status: 'pending' | 'confirmed' | 'failed';
  explorer_url?: string;
  /** Arrived after the payment closed */
  late?: boolean;
  /** A test payment's deposit: its tx_id looks like a hash but is on no chain. Tell it by this flag, never by the tx_id */
  simulated?: boolean;
}

/**
 * The payer's view of a payment: exactly what `GET {baseUrl}/checkout/{checkout_token}` answers
 * (amounts are decimal strings, times RFC 3339). Only the fields the widget uses are typed.
 */
export interface PayitgoCheckoutState {
  id: string;
  order_id: string;
  status: PayitgoStatus;
  livemode: boolean;
  /** "" until the coin is chosen */
  token: PayitgoTokenId | '';
  chain: PayitgoChain | '';
  token_options?: PayitgoTokenOption[];
  network?: string;
  token_name?: string;
  deposit_address: string;
  /** XRP only, and required */
  destination_tag?: number;
  qr_payload: string;
  /** What the customer must send, in `token` */
  crypto_amount: string;
  /** What has arrived so far, in `token` */
  received_amount: string;
  /** The merchant's price in dollars */
  usd_amount: string;
  /** What the customer pays in dollars: `usd_amount`, or more when the fees are passed on (once a coin is chosen) */
  amount_due_usd: string;
  /**
   * The merchant's price in its own currency, when it priced the payment in one (display only: the customer
   * pays in crypto). Absent for a payment priced in dollars
   */
  price_amount?: string;
  /** ISO 4217 code of `price_amount`, upper case: "EUR" */
  price_currency?: string;
  /** Dollars per unit of `price_currency`, fixed at creation. Not needed for display */
  price_rate?: string;
  /** The customer pays the network and service fees: each of `token_options` has its own `amount_due_usd` */
  fees_paid_by_customer?: boolean;
  /** Dollar value of what counts so far */
  received_usd?: string;
  expires_at: string;
  network_fee_note: string;
  confirmations: number;
  confirmations_required: number;
  tx_id?: string;
  explorer_url?: string;
  paid_late?: boolean;
  overpaid?: boolean;
  /** Every transfer to the payment; [] until one arrives */
  deposits?: PayitgoDeposit[];
  /** Test payments only, once an outcome was asked for */
  simulation?: PayitgoSimulation;
  description?: string;
  success_url?: string;
  cancel_url?: string;
}

/**
 * Connects the widget to payitgo. Use `payitgoCheckout({ createPayment })` for real payments, or
 * `demoAdapter` for an offline simulation. Every method may throw; the widget shows the error with a retry.
 */
export interface PayitgoAdapter {
  /** Starts the payment for this opening of the widget and returns its checkout token (an opaque string). */
  start(payment: PayitgoPayment): Promise<string>;
  /** Reads the payer's view of the payment. */
  get(checkoutToken: string): Promise<PayitgoCheckoutState>;
  /** Sets the coin of a payment created without one (once). */
  chooseToken(checkoutToken: string, token: PayitgoTokenId): Promise<PayitgoCheckoutState>;
  /**
   * How often the widget re-reads the payment with `get()`, in ms (default 4000). With `subscribe`, only while
   * the live connection is down.
   */
  pollIntervalMs?: number;
  /**
   * Optional: follows the payment live. Call `onPayment` with the whole payment after every change (and once
   * on (re)connecting), `onConnection(false)` while the connection is down (the widget then polls `get()`),
   * and `onNotFound` for an unknown checkout token. Returns the function that stops following it.
   */
  subscribe?(checkoutToken: string, handlers: PayitgoSubscription): () => void;
  /** Optional, test payments only: plays an outcome (POST /checkout/{token}/simulate). The widget then shows simulate buttons. */
  simulate?(checkoutToken: string, outcome: PayitgoSimulateOutcome): Promise<PayitgoCheckoutState>;
  /** Demo only: pretends the customer paid. The widget then shows a "Simulate payment" button. */
  simulatePayment?(checkoutToken: string): void;
}

/** What `PayitgoAdapter.subscribe` reports */
export interface PayitgoSubscription {
  /** The whole payment after a change; `type` says what happened (e.g. "payment.detecting") */
  onPayment(state: PayitgoCheckoutState, type: string): void;
  /** true once subscribed, false while the connection is down */
  onConnection?(connected: boolean): void;
  /** The checkout token is unknown: the subscription has ended */
  onNotFound?(message: string): void;
}

/**
 * Passed to `onSuccess` once the payment is confirmed.
 *
 * This is NOT proof of payment: it comes from the customer's browser. Fulfil the order from the
 * `payment.confirmed` webhook your server receives (or by reading the payment on your server).
 */
export interface PayitgoResult {
  /** payitgo's payment id (an opaque string) */
  paymentId: string;
  status: 'confirmed';
  /** The coin it was paid in, e.g. "USDT_TRC20" */
  token: PayitgoTokenId;
  /** The amount paid, in `token`, as a decimal string */
  amount: string;
  /** The latest deposit's transaction id, when known */
  txId?: string;
}
