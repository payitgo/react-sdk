'use client';
import { useState } from 'react';
import { PayitgoError } from '../checkoutAdapter.js';
import type { PayitgoCheckoutState, PayitgoSimulateOutcome } from '../types.js';

const OUTCOMES: { outcome: PayitgoSimulateOutcome; label: string; hint: string }[] = [
  { outcome: 'confirmed', label: 'Pay in full', hint: 'The exact amount arrives, then confirms' },
  { outcome: 'overpaid', label: 'Overpay', hint: '5% more arrives: confirmed, overpaid' },
  { outcome: 'partially_paid', label: 'Pay half', hint: 'Half of what is still due arrives; the payment stays open' },
  { outcome: 'underpaid', label: 'Underpay', hint: 'Half arrives, then the deadline passes' },
  { outcome: 'expired', label: 'Let it expire', hint: 'Nothing arrives and the deadline passes now' },
  { outcome: 'failed', label: 'Drop the transaction', hint: 'The amount arrives, then its transaction is dropped' },
  { outcome: 'wrong_asset', label: 'Pay in another coin', hint: 'The amount arrives in another coin on the same network' },
  { outcome: 'paid_late', label: 'Pay late', hint: 'Half arrives, the deadline passes, then the rest' },
  { outcome: 'paid_twice', label: 'Pay twice', hint: 'Paid in full, then the same again after it confirmed' },
];
const labelOf = (o: string) => OUTCOMES.find(x => x.outcome === o)?.label ?? o;
/** These addresses only receive their own coin */
const SINGLE_ASSET = new Set(['bitcoin', 'litecoin', 'dogecoin', 'xrp']);

interface Props {
  state: PayitgoCheckoutState;
  simulate: (outcome: PayitgoSimulateOutcome) => Promise<PayitgoCheckoutState>;
  onState: (s: PayitgoCheckoutState) => void;
  /** Re-read the payment (it moved on) */
  onReload: () => void;
}

/** Test payments only: plays what the customer does. The result arrives like real coins would. */
export function SimulatePanel({ state, simulate, onState, onReload }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [hidden, setHidden] = useState(false);
  if (state.livemode || hidden) return null;

  const sim = state.simulation;
  const running = sim?.state === 'running';
  const open = state.status === 'pending' || state.status === 'partially_paid';
  const enabled = (o: PayitgoSimulateOutcome) => {
    if (!open || running || busy) return false;
    // Before the coin, an outcome waits for it; another coin arriving depends on the coin's network
    if (o === 'wrong_asset') return !!state.token && !SINGLE_ASSET.has(state.chain);
    return true;
  };

  const run = async (outcome: PayitgoSimulateOutcome) => {
    setBusy(true);
    setError('');
    try {
      onState(await simulate(outcome));
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (e instanceof PayitgoError && e.status === 409) setError('A simulation is already running. Wait for it to finish.');
      else if (/only test payments/i.test(msg)) setHidden(true);
      else if (/choose the payment/i.test(msg)) setError('Choose a coin to simulate a payment.');
      else if (/only a pending or partially paid/i.test(msg)) onReload();
      else setError(msg || 'The simulation could not start. Try again.');
    } finally {
      setBusy(false);
    }
  };

  let status = '';
  if (running && sim) status = `Simulating: ${labelOf(sim.outcome)}…`;
  else if (sim?.state === 'requested') status = `Simulating: ${labelOf(sim.outcome)}, once a coin is chosen`;
  else if (sim?.state === 'done') status = `Last simulation: ${labelOf(sim.outcome)} (done)`;

  return (
    <div className="payitgo-sim" role="group" aria-label="Simulate an outcome">
      <div className="payitgo-sim-head">
        <strong>Simulate what the customer does</strong>
        {status && <span role="status" aria-live="polite">{status}</span>}
      </div>
      <div className="payitgo-sim-btns">
        {OUTCOMES.map(({ outcome, label, hint }) => (
          <button key={outcome} type="button" className="payitgo-sim-btn" title={hint} disabled={!enabled(outcome)} onClick={() => void run(outcome)}>
            {label}
          </button>
        ))}
      </div>
      {!state.token && open && sim?.state !== 'requested' && (
        <div className="payitgo-sim-note">No coin chosen yet: pick an outcome, then choose a coin and it plays.</div>
      )}
      {error && <div className="payitgo-sim-note payitgo-sim-error" role="alert">{error}</div>}
    </div>
  );
}
