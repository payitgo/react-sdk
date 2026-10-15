'use client';
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CHAIN_NAMES, coinFor, isPositive, mmss, subtractDecimal } from '../coins.js';
import { CoinIcon } from '../CoinIcon.js';
import { CopyField } from '../CopyField.js';
import { ClockIcon } from '../icons.js';
import { dueLine } from '../price.js';
import { Deposits } from './Deposits.js';
import type { PayitgoCheckoutState } from '../types.js';

/** The payment's network for people: the API's name, else the chain's */
export const networkOf = (s: PayitgoCheckoutState) => s.network || coinFor(s.token).network || (s.chain ? CHAIN_NAMES[s.chain] : '');

interface Props {
  state: PayitgoCheckoutState;
  remainingMs: number;
  /** Demo adapter only */
  onSimulate?: () => void;
  titleId: string;
}

/** pending / partially_paid: exact amount and network, QR code, address, XRP tag, countdown */
export function PayScreen({ state, remainingMs, onSimulate, titleId }: Props) {
  const coin = coinFor(state.token);
  const network = networkOf(state);
  const partial = state.status === 'partially_paid' && isPositive(state.received_amount);
  const toSend = partial ? subtractDecimal(state.crypto_amount, state.received_amount) : state.crypto_amount;
  const timeUp = remainingMs <= 0;
  const [simulated, setSimulated] = useState(false);
  const hasTag = state.destination_tag !== undefined && state.destination_tag !== null;

  return (
    <>
      <div className="payitgo-header">
        <h2 id={titleId} className="payitgo-title">{partial ? 'Send the rest' : `Send ${coin.symbol}`}</h2>
        <span role="timer" aria-label="Time left to pay" className={`payitgo-timer${remainingMs < 5 * 60 * 1000 ? ' payitgo-urgent' : ''}`}>
          <ClockIcon /> {timeUp ? 'Time is up, checking…' : mmss(remainingMs)}
        </span>
      </div>

      {partial ? (
        <div className="payitgo-info" role="status">
          We received <strong>{state.received_amount} of {state.crypto_amount} {coin.symbol}</strong>. Send the remaining{' '}
          <strong>{toSend} {coin.symbol}</strong> to the same address before the time runs out.
        </div>
      ) : (
        <p className="payitgo-subtitle">The QR code holds the address only: enter the amount{hasTag ? ' and the destination tag' : ''} in your wallet yourself, or copy each detail. The price is locked until the timer runs out.</p>
      )}
      {timeUp && (
        <p className="payitgo-note" role="status">The time to pay has run out. We are checking with the network: this updates in a moment. If you already sent the payment, keep this open.</p>
      )}

      <div className="payitgo-pay">
        {state.qr_payload && (
          <div className="payitgo-qr">
            <QRCodeSVG value={state.qr_payload.trim()} size={184} level="M" marginSize={4} bgColor="#ffffff" fgColor="#000000" title={`${coin.symbol} payment QR code`} />
          </div>
        )}
        <div className="payitgo-fields">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <CoinIcon token={state.token} size={36} />
            <div style={{ minWidth: 0 }}>
              <div className="payitgo-amount" style={{ margin: 0, fontSize: 22, wordBreak: 'break-all' }}>{toSend} {coin.symbol}</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>on {network}</div>
              <div className="payitgo-muted" style={{ fontSize: 12 }}>{dueLine(state, state.amount_due_usd)}{partial ? ' in total' : ''}</div>
            </div>
          </div>
          <CopyField label={`${coin.symbol} address`} value={state.deposit_address} />
          {hasTag && (
            <CopyField
              label="Destination tag"
              value={String(state.destination_tag)}
              required
              hint="Enter this tag in your wallet. Without it the payment can't be matched."
            />
          )}
          <CopyField label={partial ? 'Remaining amount' : 'Amount'} value={toSend} display={<>{toSend} {coin.symbol}</>} />
        </div>
      </div>

      <div className="payitgo-warning" role="note">
        Send only <strong>{coin.symbol}</strong> on <strong>{network}</strong>; other coins or networks can be lost.
        The amount must <strong>arrive in full</strong>: your wallet&apos;s fee comes on top (an exchange that takes its fee out of the amount makes the payment arrive short).
        {state.network_fee_note ? <> {state.network_fee_note}</> : null}
      </div>

      {/* Each transfer with its own confirmations while partially paid, and any coin that does not count */}
      <Deposits deposits={state.deposits} />

      <div className="payitgo-footer" style={{ alignItems: 'center' }}>
        <span className="payitgo-muted" style={{ fontSize: 12, marginRight: 'auto' }} aria-live="polite">Waiting for your payment…</span>
        {onSimulate && (
          <button type="button" className="payitgo-btn payitgo-btn-primary" disabled={simulated} onClick={() => { setSimulated(true); onSimulate(); }}>
            {simulated ? 'Sending…' : 'Simulate payment'}
          </button>
        )}
      </div>
    </>
  );
}
