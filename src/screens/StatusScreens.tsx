'use client';
import { useState } from 'react';
import { coinFor, formatMoney, isPositive, tickerOf } from '../coins.js';
import { CopyField } from '../CopyField.js';
import { AlertIcon, CheckIcon, ClockIcon, SpinnerIcon } from '../icons.js';
import type { PayitgoCheckoutState, PayitgoPayment } from '../types.js';
import { Deposits } from './Deposits.js';
import { networkOf } from './PayScreen.js';

const shortHash = (h: string) => (h.length > 24 ? `${h.slice(0, 12)}…${h.slice(-8)}` : h);

function Tx({ state }: { state: PayitgoCheckoutState }) {
  if (!state.tx_id) return null;
  return (
    <div style={{ marginTop: 14 }}>
      <CopyField label="Transaction" value={state.tx_id} display={shortHash(state.tx_id)} />
      {state.explorer_url && (
        <a className="payitgo-link" href={state.explorer_url} target="_blank" rel="noreferrer">View on the block explorer</a>
      )}
    </div>
  );
}

export function LoadingScreen({ payment, titleId }: { payment: PayitgoPayment; titleId: string }) {
  return (
    <div aria-live="polite">
      <div className="payitgo-status">
        <span className="payitgo-status-icon"><SpinnerIcon /></span>
        <h2 id={titleId}>{payment.title}</h2>
        <p>Preparing your payment of {formatMoney(payment.amount.value, payment.amount.currency)}…</p>
      </div>
    </div>
  );
}

/** detecting: enough arrived, waiting for confirmations. No countdown: the customer must not pay again */
export function ConfirmingScreen({ state, titleId }: { state: PayitgoCheckoutState; titleId: string }) {
  const ticker = tickerOf(state);
  const required = state.confirmations_required || coinFor(state.token).confirmations;
  const done = Math.min(state.confirmations ?? 0, required);
  return (
    <div aria-live="polite">
      <div className="payitgo-status">
        <span className="payitgo-status-icon"><SpinnerIcon /></span>
        <h2 id={titleId}>Payment received, confirming…</h2>
        <p>Your {ticker} arrived on {networkOf(state)}. The network is confirming it. Don&apos;t send it again.</p>
      </div>
      {required > 0 && (
        <>
          <div className="payitgo-progress" role="progressbar" aria-label="Confirmations" aria-valuemin={0} aria-valuemax={required} aria-valuenow={done}>
            <span style={{ width: `${Math.round((done / required) * 100)}%` }} />
          </div>
          <div className="payitgo-muted" style={{ marginTop: 8, fontSize: 12, textAlign: 'right' }}>{done} / {required} confirmations</div>
        </>
      )}
      {state.paid_late && <p className="payitgo-note" style={{ textAlign: 'center' }}>It arrived after the deadline and completes the payment.</p>}
      <Tx state={state} />
      <Deposits deposits={state.deposits} />
    </div>
  );
}

/** Money that arrived after the payment closed (the address is watched for 24 hours) */
const lateOf = (state: PayitgoCheckoutState) => (state.deposits ?? []).filter(d => d.late);

/** A link back to the shop (success_url / cancel_url), when the host turned them on and the payment has one */
function ShopLink({ href, primary, children }: { href?: string; primary?: boolean; children: React.ReactNode }) {
  if (!href || !/^https?:\/\//i.test(href)) return null;
  return <a className={`payitgo-btn ${primary ? 'payitgo-btn-primary' : 'payitgo-btn-secondary'}`} href={href}>{children}</a>;
}

export function PaidScreen({ payment, state, onDone, returnLinks, titleId }: { payment: PayitgoPayment; state: PayitgoCheckoutState; onDone: () => void; returnLinks?: boolean; titleId: string }) {
  const ticker = tickerOf(state);
  const paid = state.crypto_received && state.crypto_received !== '0' ? state.crypto_received : state.crypto_amount;
  const rows: [string, string][] = [
    ['For', payment.lineItem ?? payment.title],
    ['Amount paid', `${paid} ${ticker}`],
    // amount_received: what counts, in the payment's currency; amount_due only as a fallback
    ['Value', formatMoney(isPositive(state.amount_received) ? state.amount_received! : state.amount_due, state.currency)],
    ['Network', networkOf(state)],
  ];
  const success = returnLinks ? state.success_url : undefined;
  return (
    <div aria-live="polite">
      <div className="payitgo-status">
        <span className="payitgo-status-icon payitgo-success"><CheckIcon size={28} /></span>
        <h2 id={titleId}>Paid</h2>
        <p>Your payment is confirmed on-chain.{state.paid_late ? ' It arrived after the deadline and was accepted.' : ''}</p>
      </div>
      <div className="payitgo-summary">
        {rows.map(([k, v]) => <div key={k} className="payitgo-row"><span className="payitgo-muted">{k}</span><strong style={{ fontWeight: 600, wordBreak: 'break-all', textAlign: 'right' }}>{v}</strong></div>)}
      </div>
      <Tx state={state} />
      {(state.deposits?.length ?? 0) > 1 && <Deposits deposits={state.deposits} />}
      <div className="payitgo-footer">
        {success
          ? <>
              <button type="button" className="payitgo-btn payitgo-btn-secondary" onClick={onDone}>Done</button>
              <ShopLink href={success} primary>Back to the shop</ShopLink>
            </>
          : <button type="button" className="payitgo-btn payitgo-btn-primary" onClick={onDone}>Done</button>}
      </div>
    </div>
  );
}

interface ClosedProps {
  state: PayitgoCheckoutState;
  onClose: () => void;
  /** Show a link to the payment's cancel_url */
  returnLinks?: boolean;
  titleId: string;
}

/**
 * expired. The address stays watched for 24 hours: money sent to it can still complete this payment late
 * (the widget keeps following it). So once an address was shown, starting a new payment asks the customer to
 * confirm they sent nothing, and once anything arrived it is not offered at all.
 */
export function ExpiredScreen({ state, onRestart, onClose, returnLinks, titleId }: ClosedProps & { onRestart: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const addressShown = !!state.token;
  const anythingArrived = (state.deposits?.length ?? 0) > 0;
  const cancel = returnLinks ? state.cancel_url : undefined;
  return (
    <div aria-live="polite">
      <div className="payitgo-status">
        <span className="payitgo-status-icon"><ClockIcon /></span>
        <h2 id={titleId}>This payment expired</h2>
        <p>
          The time to pay ran out before a payment arrived{addressShown ? ', so the locked price no longer applies' : ''}.
          {addressShown
            ? ' If you already sent it, keep this open: a payment that arrives within 24 hours can still complete it.'
            : ' You can start a new payment.'}
        </p>
      </div>
      <Deposits deposits={lateOf(state)} title="Arrived after the deadline" />
      {confirming && (
        <p className="payitgo-warning" role="alert">
          Start a new payment only if you have sent nothing to the address shown before. The new payment has a new
          address and amount; coins sent to the old address count only toward the old payment.
        </p>
      )}
      <div className="payitgo-footer">
        <button type="button" className="payitgo-btn payitgo-btn-secondary" onClick={onClose}>Close</button>
        <ShopLink href={cancel}>Back to the shop</ShopLink>
        {!anythingArrived && (
          addressShown && !confirming
            ? <button type="button" className="payitgo-btn payitgo-btn-secondary" onClick={() => setConfirming(true)}>Start a new payment</button>
            : <button type="button" className="payitgo-btn payitgo-btn-primary" onClick={onRestart}>{confirming ? 'I sent nothing: start again' : 'Start again'}</button>
        )}
      </div>
    </div>
  );
}

export function UnderpaidScreen({ state, onClose, returnLinks, titleId }: ClosedProps) {
  const ticker = tickerOf(state);
  const cancel = returnLinks ? state.cancel_url : undefined;
  return (
    <div aria-live="polite">
      <div className="payitgo-status">
        <span className="payitgo-status-icon payitgo-warn"><AlertIcon /></span>
        <h2 id={titleId}>Only part of the amount arrived</h2>
        <p>
          Only {state.crypto_received} of {state.crypto_amount} {ticker} arrived before the deadline. Please contact the merchant
          (order {state.order_id}): they have received what you sent and can refund it or agree on the rest.
        </p>
        <p style={{ marginTop: 8, fontSize: 12 }}>
          If you sent the rest, keep this open: money that completes the payment within 24 hours of the deadline still counts.
        </p>
      </div>
      <Deposits deposits={state.deposits} />
      <div className="payitgo-footer">
        <button type="button" className="payitgo-btn payitgo-btn-secondary" onClick={onClose}>Close</button>
        <ShopLink href={cancel}>Back to the shop</ShopLink>
      </div>
    </div>
  );
}

export function FailedScreen({ state, onClose, returnLinks, titleId }: ClosedProps) {
  const cancel = returnLinks ? state.cancel_url : undefined;
  return (
    <div aria-live="polite">
      <div className="payitgo-status">
        <span className="payitgo-status-icon payitgo-warn"><AlertIcon /></span>
        <h2 id={titleId}>The payment could not be confirmed</h2>
        <p>The network never confirmed the transfer. Please contact the merchant with your order number ({state.order_id}).</p>
      </div>
      <Tx state={state} />
      <div className="payitgo-footer">
        <button type="button" className="payitgo-btn payitgo-btn-secondary" onClick={onClose}>Close</button>
        <ShopLink href={cancel}>Back to the shop</ShopLink>
      </div>
    </div>
  );
}

/** Unknown checkout token ("payment not found"): nothing to retry, and no new payment is started */
export function NotFoundScreen({ onClose, titleId }: { onClose: () => void; titleId: string }) {
  return (
    <>
      <div className="payitgo-status">
        <span className="payitgo-status-icon payitgo-warn"><AlertIcon /></span>
        <h2 id={titleId}>Payment not found</h2>
        <p>This payment doesn&apos;t exist. Please close this and try again from the shop, or contact the merchant.</p>
      </div>
      <div className="payitgo-footer">
        <button type="button" className="payitgo-btn payitgo-btn-secondary" onClick={onClose}>Close</button>
      </div>
    </>
  );
}

export function ErrorScreen({ message, onRetry, onClose, titleId }: { message: string; onRetry: () => void; onClose: () => void; titleId: string }) {
  return (
    <>
      <div className="payitgo-status">
        <span className="payitgo-status-icon payitgo-warn"><AlertIcon /></span>
        <h2 id={titleId}>Couldn&apos;t start the payment</h2>
        <p>{message}</p>
      </div>
      <div className="payitgo-footer">
        <button type="button" className="payitgo-btn payitgo-btn-secondary" onClick={onClose}>Close</button>
        <button type="button" className="payitgo-btn payitgo-btn-primary" onClick={onRetry}>Try again</button>
      </div>
    </>
  );
}
