'use client';
import { useRef } from 'react';
import { CHAIN_NAMES, coinFor, formatPrice, formatUsd, mmss, type PayitgoTokenId } from '../coins.js';
import { CoinIcon } from '../CoinIcon.js';
import { CheckIcon } from '../icons.js';
import { sortOptions } from '../price.js';
import type { PayitgoCheckoutState, PayitgoPayment } from '../types.js';

interface Props {
  payment: PayitgoPayment;
  state: PayitgoCheckoutState;
  /** Changing the coin chosen before (state.token): "Back" returns to it */
  changing?: boolean;
  selected: PayitgoTokenId | '';
  onSelect: (id: PayitgoTokenId) => void;
  onCancel: () => void;
  onPay: () => void;
  busy: boolean;
  error: string;
  /** Time left to choose a coin */
  remainingMs: number;
  titleId: string;
}

/** Order header plus the payment's token_options. Paying posts the chosen coin. */
export function SelectScreen({ payment, state, changing, selected, onSelect, onCancel, onPay, busy, error, remainingMs, titleId }: Props) {
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Cheapest network first when the fees are passed on (each option then has its own amount_due_usd)
  const options = sortOptions(state.token_options);
  const current = options.find(o => o.token === selected);
  // Without a per-option total every option costs the payment's amount_due_usd
  const due = current?.amount_due_usd || state.amount_due_usd;
  const price = formatPrice(state.price_amount, state.price_currency);
  // Fees passed on: until a coin is chosen the top-level amount_due_usd is only the price
  const perCoin = !!state.fees_paid_by_customer;
  const timeUp = remainingMs <= 0;
  const keeping = changing && selected === state.token;

  // Radio-group keyboard support: arrows move the selection and focus
  const onKeyDown = (e: React.KeyboardEvent) => {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!(e.key in keys) || !options.length) return;
    e.preventDefault();
    const index = Math.max(0, options.findIndex(o => o.token === selected));
    const next = (index + keys[e.key] + options.length) % options.length;
    onSelect(options[next].token);
    optionRefs.current[next]?.focus();
  };

  return (
    <>
      <div className="payitgo-header">
        <h2 id={titleId} className="payitgo-title">{payment.title}</h2>
        {payment.period && <span className="payitgo-pill">{payment.period}</span>}
        {payment.badge && <span className="payitgo-badge">{payment.badge}</span>}
      </div>
      {payment.description && <p className="payitgo-subtitle">{payment.description}</p>}

      <div className="payitgo-amount-card">
        <div>
          <div className="payitgo-label">{perCoin ? 'Price' : 'Amount'}</div>
          <div className="payitgo-amount">{price || formatUsd(perCoin ? state.usd_amount : state.amount_due_usd)}</div>
          {perCoin
            ? <div className="payitgo-muted">{current?.amount_due_usd ? `You pay ≈ ${formatUsd(current.amount_due_usd)} with fees in ${current.ticker || coinFor(current.token).symbol}` : 'Plus network and service fees, by coin'}</div>
            : price ? <div className="payitgo-muted">≈ {formatUsd(state.amount_due_usd)}</div> : null}
          {payment.lineItem && <div className="payitgo-muted">{payment.lineItem}</div>}
        </div>
        <div className="payitgo-meta">
          {payment.due && <span className="payitgo-due">Due on {payment.due}</span>}
          <span className="payitgo-meta-row" role="timer" aria-label="Time left to choose a coin">
            {timeUp ? <strong>Time is up, checking…</strong> : <>Choose within{' '}<strong>{mmss(remainingMs)}</strong></>}
          </span>
        </div>
      </div>

      {options.length === 0 ? (
        <p className="payitgo-note" role="alert">No coin is available for this amount right now. Please contact the merchant.</p>
      ) : (
        <>
          <div className="payitgo-section-label" id={`${titleId}-paywith`}>Pay with</div>
          <div role="radiogroup" aria-labelledby={`${titleId}-paywith`} className="payitgo-grid" onKeyDown={onKeyDown}>
            {options.map((o, i) => {
              const c = coinFor(o.token);
              const checked = o.token === selected;
              return (
                <button
                  key={o.token}
                  ref={(el) => { optionRefs.current[i] = el; }}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  tabIndex={checked || (!selected && i === 0) ? 0 : -1}
                  className="payitgo-option"
                  onClick={() => onSelect(o.token)}
                >
                  <CoinIcon token={o.token} iconUrl={o.icon_url} />
                  <span style={{ minWidth: 0 }}>
                    <span className="payitgo-option-name">{o.name ?? c.name} <span className="payitgo-muted" style={{ fontWeight: 400 }}>{o.ticker || c.symbol}</span></span>
                    <span className="payitgo-option-sub">{o.network || c.network || CHAIN_NAMES[o.chain]}</span>
                    <span className="payitgo-option-sub" style={{ fontWeight: 600, color: 'var(--payitgo-text)' }}>
                      {formatUsd(o.amount_due_usd || state.amount_due_usd)}{o.amount_due_usd ? ' with fees' : ''}
                    </span>
                    {o.fee_note && <span className="payitgo-option-sub">{o.fee_note}</span>}
                  </span>
                  {checked && <span className="payitgo-check"><CheckIcon /></span>}
                </button>
              );
            })}
          </div>
        </>
      )}

      {current ? (
        <p className="payitgo-note">
          {keeping
            ? `You keep paying in ${current.ticker || coinFor(current.token).symbol}, at the same address.`
            : `You will pay in ${current.ticker || coinFor(current.token).symbol} on ${current.network || coinFor(current.token).network || CHAIN_NAMES[current.chain]}${changing ? ' instead, at a new address' : ''}. The price is then locked for 15 minutes.`}
        </p>
      ) : null}
      {error && <p className="payitgo-error" role="alert">{error}</p>}

      <div className="payitgo-footer">
        <button type="button" className="payitgo-btn payitgo-btn-secondary" onClick={onCancel}>{changing ? 'Back' : 'Not now'}</button>
        <button type="button" className="payitgo-btn payitgo-btn-primary" onClick={onPay} disabled={busy || !options.length}>
          {busy ? 'Preparing…' : keeping ? 'Keep this coin' : `Pay ${formatUsd(due)}`}
        </button>
      </div>
    </>
  );
}
