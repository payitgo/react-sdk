'use client';
import { coinFor } from '../coins.js';
import type { PayitgoDeposit } from '../types.js';

const shortHash = (h: string) => (h.length > 24 ? `${h.slice(0, 12)}…${h.slice(-8)}` : h);
const STATUS: Record<PayitgoDeposit['status'], string> = { pending: 'Confirming', confirmed: 'Confirmed', failed: 'Dropped' };

/**
 * Every transfer to the payment (`deposits[]`): its amount and coin, its own confirmations while it confirms,
 * "Not counted" for another coin than the payment asked for, and "Late" for one that arrived after it closed
 */
export function Deposits({ deposits, title = 'Transfers received' }: { deposits?: PayitgoDeposit[]; title?: string }) {
  if (!deposits?.length) return null;
  return (
    <div className="payitgo-deposits">
      <div className="payitgo-label">{title}</div>
      <ul>
        {deposits.map((d, i) => {
          const coin = coinFor(d.token);
          const confs = d.status === 'pending' && d.confirmations_required ? ` · ${d.confirmations ?? 0} of ${d.confirmations_required}` : '';
          return (
            <li key={`${d.tx_id}-${i}`}>
              <span style={{ minWidth: 0 }}>
                <strong style={{ fontWeight: 600, wordBreak: 'break-all' }}>{d.amount} {coin.symbol}</strong>
                <span className="payitgo-option-sub">
                  {d.explorer_url
                    ? <a className="payitgo-link" style={{ marginTop: 0 }} href={d.explorer_url} target="_blank" rel="noreferrer">{shortHash(d.tx_id)}</a>
                    : <span title={d.tx_id}>{shortHash(d.tx_id)}{d.simulated ? ' (test, on no chain)' : ''}</span>}
                </span>
              </span>
              <span className="payitgo-tags">
                <span className={`payitgo-tag payitgo-tag-${d.status}`}>{STATUS[d.status] ?? d.status}{confs}</span>
                {!d.counted && <span className="payitgo-tag payitgo-tag-warn" title="Another coin than this payment asked for: it does not count toward the amount">Not counted</span>}
                {d.late && <span className="payitgo-tag">Late</span>}
              </span>
            </li>
          );
        })}
      </ul>
      {deposits.some(d => !d.counted) && (
        <p className="payitgo-note" style={{ marginTop: 6 }}>A transfer marked &ldquo;Not counted&rdquo; was in another coin than this payment asked for. Contact the merchant about it.</p>
      )}
    </div>
  );
}
