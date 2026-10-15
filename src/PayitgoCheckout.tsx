'use client';
import { useCallback, useEffect, useId, useInsertionEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

import type { PayitgoTokenId } from './coins.js';
import { demoAdapter } from './demoAdapter.js';
import { CloseIcon } from './icons.js';
import { sortOptions } from './price.js';
import { css } from './styles.js';
import type { PayitgoAdapter, PayitgoCheckoutState, PayitgoPayment, PayitgoResult, PayitgoTheme } from './types.js';
import { SelectScreen } from './screens/SelectScreen.js';
import { PayScreen } from './screens/PayScreen.js';
import { SimulatePanel } from './screens/SimulatePanel.js';
import { ConfirmingScreen, ErrorScreen, ExpiredScreen, FailedScreen, LoadingScreen, NotFoundScreen, PaidScreen, UnderpaidScreen } from './screens/StatusScreens.js';

export interface PayitgoCheckoutProps {
  open: boolean;
  onClose: () => void;
  payment: PayitgoPayment;
  theme?: PayitgoTheme;
  /** Backend connection: `payitgoCheckout({ createPayment })` for real payments. Defaults to `demoAdapter` (offline simulation). */
  adapter?: PayitgoAdapter;
  /**
   * Called once when the payment is confirmed.
   *
   * Not proof of payment: it runs in the customer's browser. Fulfil the order from the
   * `payment.confirmed` webhook on your server (or by reading the payment there), never from this callback.
   */
  onSuccess?: (result: PayitgoResult) => void;
  /**
   * Offer the payment's `success_url` ("Back to the shop" once paid) and `cancel_url` (when it closes unpaid)
   * as links, when it has them. Off by default: the widget usually opens on the shop's own page, where closing
   * the modal is the way back. Turn it on when those URLs lead somewhere else (another page of your app).
   */
  returnLinks?: boolean;
}

const noopSubscribe = () => () => {};

const STYLE_ID = 'payitgo-widget-styles';

/** The widget's styles, added to the document once, the first time a checkout opens */
function useWidgetStyles() {
  useInsertionEffect(() => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }, []);
}

/** Controlled payment modal. Render it anywhere; it portals to document.body when open. */
export function PayitgoCheckout(props: PayitgoCheckoutProps) {
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!props.open || !isClient) return null;
  // Mounting the dialog only while open gives every opening a fresh payment
  return createPortal(<CheckoutDialog {...props} />, document.body);
}

const FOCUSABLE = 'button:not([disabled]),a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';
/** Money that arrives up to 24 hours after a payment closed can still complete it */
const LATE_WINDOW_MS = 24 * 60 * 60 * 1000;

const isSettled = (s: PayitgoCheckoutState) =>
  s.status === 'confirmed' || s.status === 'failed' ||
  ((s.status === 'expired' || s.status === 'underpaid') && Date.now() > new Date(s.expires_at).getTime() + LATE_WINDOW_MS);

const messageOf = (e: unknown) => (e instanceof Error && e.message ? e.message : 'Something went wrong. Please try again.');
/** The HTTP status of an adapter error (PayitgoError, or any error with a numeric `status`), else 0 */
const statusOf = (e: unknown) => {
  const status = (e as { status?: unknown } | null)?.status;
  return typeof status === 'number' ? status : 0;
};

function CheckoutDialog({ onClose, payment, theme, adapter = demoAdapter, onSuccess, returnLinks }: PayitgoCheckoutProps) {
  useWidgetStyles();
  const [checkoutToken, setCheckoutToken] = useState<string | null>(null);
  const [state, setState] = useState<PayitgoCheckoutState | null>(null);
  const [startError, setStartError] = useState('');
  // The checkout token is unknown ("payment not found"): no retry, no reconnect, no new payment
  const [notFound, setNotFound] = useState(false);
  // POST /token answered "this payment can no longer be paid": the expired view, even while GET still says pending
  const [choiceClosed, setChoiceClosed] = useState(false);
  const [selected, setSelected] = useState<PayitgoTokenId | ''>('');
  const [choosing, setChoosing] = useState(false);
  const [chooseError, setChooseError] = useState('');
  const [now, setNow] = useState(0);
  const [run, setRun] = useState(0);
  // Subscribed on the adapter's live connection: no polling meanwhile
  const [live, setLive] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const starting = useRef<{ run: number; promise: Promise<{ cs: string; s: PayitgoCheckoutState }> } | null>(null);
  const succeeded = useRef(false);
  const titleId = useId();

  // Latest props for the effects below, without restarting them when the host re-renders
  const latest = useRef({ adapter, payment, onSuccess });
  useEffect(() => { latest.current = { adapter, payment, onSuccess }; });

  // Lock page scroll, focus the dialog, and restore focus to the opener on close
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    modalRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      opener?.focus?.();
    };
  }, []);

  // Create the payment once per opening (and again only when the customer asks to start over)
  useEffect(() => {
    // One call per run, even when React runs this effect twice (Strict Mode)
    if (starting.current?.run !== run) {
      const { adapter: a, payment: p } = latest.current;
      starting.current = {
        run,
        promise: a.start(p).then(async (cs) => {
          try {
            return { cs, s: await a.get(cs) };
          } catch (e) {
            if (statusOf(e) === 404) throw Object.assign(new Error('payment not found'), { notFound: true });
            throw e;
          }
        }),
      };
    }
    let cancelled = false;
    starting.current.promise.then(
      ({ cs, s }) => {
        if (cancelled) return;
        setCheckoutToken(cs);
        setState(s);
        setSelected(sortOptions(s.token_options)[0]?.token ?? '');
        setNow(Date.now());
      },
      (e) => {
        if (cancelled) return;
        if ((e as { notFound?: boolean }).notFound) setNotFound(true);
        else setStartError(messageOf(e));
      },
    );
    return () => { cancelled = true; };
  }, [run]);

  // Follow the payment live (socket.io) when the adapter can. It stays open after expired / underpaid:
  // a late payment can still complete them. Nothing more happens after confirmed / failed.
  const done = state?.status === 'confirmed' || state?.status === 'failed';
  useEffect(() => {
    const { subscribe } = latest.current.adapter;
    if (!checkoutToken || done || notFound || !subscribe) return;
    return subscribe(checkoutToken, {
      onPayment: (s) => { setState(s); setNow(Date.now()); },
      onConnection: setLive,
      onNotFound: () => { setLive(false); setNotFound(true); },
    });
  }, [checkoutToken, done, notFound]);

  // Otherwise (or while the live connection is down) re-read the payment while it can still change
  const settled = !state || isSettled(state);
  useEffect(() => {
    if (!checkoutToken || settled || live || notFound) return;
    let stopped = false;
    const id = setInterval(() => {
      latest.current.adapter.get(checkoutToken).then(
        (s) => { if (!stopped) { setState(s); setNow(Date.now()); } },
        (e) => { if (!stopped && statusOf(e) === 404) setNotFound(true); /* otherwise transient: the next poll tries again */ },
      );
    }, latest.current.adapter.pollIntervalMs ?? 4000);
    return () => { stopped = true; clearInterval(id); };
  }, [checkoutToken, settled, live, notFound]);

  // Countdown while the customer can pay
  const counting = !!state && (state.status === 'pending' || state.status === 'partially_paid');
  useEffect(() => {
    if (!counting) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [counting]);

  // Tell the host once, when the payment is confirmed
  useEffect(() => {
    if (state?.status !== 'confirmed' || succeeded.current || !state.token) return;
    succeeded.current = true;
    latest.current.onSuccess?.({
      paymentId: state.id,
      status: 'confirmed',
      token: state.token,
      amount: state.received_amount && state.received_amount !== '0' ? state.received_amount : state.crypto_amount,
      txId: state.tx_id,
    });
  }, [state]);

  const restart = useCallback(() => {
    setCheckoutToken(null);
    setState(null);
    setStartError('');
    setChooseError('');
    setNotFound(false);
    setChoiceClosed(false);
    setLive(false);
    setRun(r => r + 1);
  }, []);

  const choose = async () => {
    if (!checkoutToken || !selected) { setChooseError('Choose a coin to continue.'); return; }
    setChoosing(true);
    setChooseError('');
    try {
      const s = await adapter.chooseToken(checkoutToken, selected);
      setState(s);
      setNow(Date.now());
    } catch (e) {
      const status = statusOf(e);
      const message = messageOf(e);
      if (status === 404) setNotFound(true);
      else if (status === 400 && /no longer be paid/i.test(message)) setChoiceClosed(true);
      else if (status === 400 && /not one of this payment's options/i.test(message)) {
        // The options changed: reload the payment and let the customer choose again
        try {
          const s = await adapter.get(checkoutToken);
          setState(s);
          setSelected(sortOptions(s.token_options)[0]?.token ?? '');
          setNow(Date.now());
        } catch { /* the poll or the socket brings it */ }
        setChooseError('That coin is no longer offered for this payment. Choose another.');
      } else setChooseError(messageOf(e));
    } finally {
      setChoosing(false);
    }
  };

  // Escape closes; Tab stays inside the dialog
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !modalRef.current) return;
    const items = [...modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(el => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const remainingMs = state ? new Date(state.expires_at).getTime() - now : 0;
  const isDemo = !!adapter.simulatePayment;

  let body: React.ReactNode;
  if (notFound) {
    body = <NotFoundScreen onClose={onClose} titleId={titleId} />;
  } else if (startError) {
    body = <ErrorScreen message={startError} onRetry={restart} onClose={onClose} titleId={titleId} />;
  } else if (!state || !checkoutToken) {
    body = <LoadingScreen payment={payment} titleId={titleId} />;
  } else if (choiceClosed && state.status === 'pending' && !state.token) {
    body = <ExpiredScreen state={state} onRestart={restart} onClose={onClose} returnLinks={returnLinks} titleId={titleId} />;
  } else if ((state.status === 'pending' || state.status === 'partially_paid') && !state.token) {
    body = (
      <SelectScreen
        payment={payment}
        state={state}
        selected={selected}
        onSelect={(t) => { setSelected(t); setChooseError(''); }}
        onCancel={onClose}
        onPay={choose}
        busy={choosing}
        error={chooseError}
        remainingMs={remainingMs}
        titleId={titleId}
      />
    );
  } else if (state.status === 'pending' || state.status === 'partially_paid') {
    body = (
      <PayScreen
        state={state}
        remainingMs={remainingMs}
        onSimulate={adapter.simulatePayment ? () => adapter.simulatePayment?.(checkoutToken) : undefined}
        titleId={titleId}
      />
    );
  } else if (state.status === 'detecting') {
    body = <ConfirmingScreen state={state} titleId={titleId} />;
  } else if (state.status === 'confirmed') {
    body = <PaidScreen payment={payment} state={state} onDone={onClose} returnLinks={returnLinks} titleId={titleId} />;
  } else if (state.status === 'expired') {
    body = <ExpiredScreen state={state} onRestart={restart} onClose={onClose} returnLinks={returnLinks} titleId={titleId} />;
  } else if (state.status === 'underpaid') {
    body = <UnderpaidScreen state={state} onClose={onClose} returnLinks={returnLinks} titleId={titleId} />;
  } else {
    body = <FailedScreen state={state} onClose={onClose} returnLinks={returnLinks} titleId={titleId} />;
  }

  return (
    <div
      className={`payitgo-overlay${theme?.mode === 'light' ? ' payitgo-light' : ''}`}
      style={{ '--payitgo-accent': theme?.accent ?? '#5b3df5' } as React.CSSProperties}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="payitgo-modal" onKeyDown={onKeyDown}>
        <button type="button" className="payitgo-close" aria-label="Close" onClick={onClose}><CloseIcon /></button>
        {state && !state.livemode && !notFound && (
          <div className="payitgo-test" role="note">
            {isDemo
              ? 'Demo checkout: a simulation. Nothing is sent or received.'
              : `Test payment: no real coins move, and coins sent to this address are never seen.${adapter.simulate ? ' Play the customer\'s side below.' : ''}`}
          </div>
        )}
        {state && checkoutToken && !state.livemode && !startError && !notFound && adapter.simulate && (
          <SimulatePanel
            state={state}
            simulate={(outcome) => adapter.simulate!(checkoutToken, outcome)}
            onState={(s) => { setState(s); setNow(Date.now()); }}
            onReload={() => { adapter.get(checkoutToken).then((s) => { setState(s); setNow(Date.now()); }, () => {}); }}
          />
        )}
        {body}
        <div className="payitgo-powered">Secured by <strong>payitgo</strong></div>
      </div>
    </div>
  );
}
