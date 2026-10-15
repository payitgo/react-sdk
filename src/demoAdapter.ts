import { COINS, coinFor, type PayitgoTokenId } from './coins.js';
import type { PayitgoAdapter, PayitgoCheckoutState, PayitgoTokenOption } from './types.js';

// Offline simulation for previews and design work. Nothing touches a network or a wallet: the addresses
// and QR codes are deliberately invalid, so no wallet can send real money to them.

const RATES: Record<PayitgoTokenId, number> = {
  USDT_TRC20: 1, TRX: 0.33, ETH: 2600, USDT_ERC20: 1, USDC_ERC20: 1,
  BNB: 580, USDT_BEP20: 1, USDC_BEP20: 1, BTC: 67000, LTC: 84, DOGE: 0.12, XRP: 1.4,
};
const DECIMALS: Partial<Record<PayitgoTokenId, number>> = { BTC: 8, LTC: 8, DOGE: 4, ETH: 6, BNB: 6 };
const FEES: Partial<Record<PayitgoTokenId, string>> = { USDT_TRC20: '3.22', ETH: '0.40', USDT_ERC20: '1.20', USDC_ERC20: '1.20', BTC: '0.90', LTC: '0.02', DOGE: '0.05' };

const CHOOSE_MS = 60 * 60 * 1000;
const PAY_MS = 15 * 60 * 1000;

interface DemoSession {
  state: PayitgoCheckoutState;
  paidAt?: number;
}

const sessions = new Map<string, DemoSession>();
const randomHex = (n: number) => Array.from({ length: n }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

/** usd ÷ rate, rounded up to the coin's display precision */
function cryptoFor(token: PayitgoTokenId, usd: number) {
  const d = DECIMALS[token] ?? 2;
  const f = 10 ** d;
  return (Math.ceil((usd / RATES[token]) * f) / f).toFixed(d).replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');
}

const options = (usd: number): PayitgoTokenOption[] =>
  COINS.map(c => ({
    token: c.id,
    chain: c.chain,
    name: c.name,
    network: c.network,
    confirmations: c.confirmations,
    min_usd: '1',
    network_fee_usd: FEES[c.id] ?? '0.01',
    // fee_note says how long a payment takes; a demo payment confirms in seconds
    fee_note: 'Demo: final in seconds.',
  })).filter(() => usd >= 1);

/** The state as time has moved it on (expiry, simulated confirmations) */
function advance(s: DemoSession): PayitgoCheckoutState {
  const now = Date.now();
  const st = s.state;
  if (s.paidAt && st.status !== 'confirmed') {
    const required = st.confirmations_required || 1;
    const elapsed = now - s.paidAt;
    const step = Math.max(300, 6000 / required);
    if (elapsed > 1500) {
      const confirmations = Math.min(required, Math.floor((elapsed - 1500) / step));
      s.state = {
        ...st,
        status: confirmations >= required ? 'confirmed' : 'detecting',
        received_amount: st.crypto_amount,
        confirmations,
        tx_id: st.tx_id ?? (st.chain === 'ethereum' || st.chain === 'bsc' ? `0x${randomHex(64)}` : randomHex(64)),
      };
    }
  } else if ((st.status === 'pending') && now > new Date(st.expires_at).getTime()) {
    s.state = { ...st, status: 'expired' };
  }
  return { ...s.state };
}

function session(checkoutToken: string) {
  const s = sessions.get(checkoutToken);
  if (!s) throw new Error('Payment not found');
  return s;
}

/** Offline simulation: every coin on offer, fake addresses, and a "Simulate payment" button. */
export const demoAdapter: PayitgoAdapter = {
  pollIntervalMs: 1000,

  async start(payment) {
    await delay(400);
    const usd = Number(payment.amount.value) || 0;
    const id = randomHex(24);
    const now = Date.now();
    sessions.set(id, {
      state: {
        id: randomHex(24),
        order_id: `demo-${randomHex(6)}`,
        status: 'pending',
        livemode: false,
        token: '',
        chain: '',
        token_options: options(usd),
        deposit_address: '',
        qr_payload: '',
        crypto_amount: '0',
        received_amount: '0',
        usd_amount: String(usd),
        amount_due_usd: String(usd),
        expires_at: new Date(now + CHOOSE_MS).toISOString(),
        network_fee_note: '',
        confirmations: 0,
        confirmations_required: 0,
        description: payment.description,
      },
    });
    return id;
  },

  async get(checkoutToken) {
    await delay(50);
    return advance(session(checkoutToken));
  },

  async chooseToken(checkoutToken, token) {
    await delay(300);
    const s = session(checkoutToken);
    if (s.state.token) return advance(s);
    const coin = coinFor(token);
    const amount = cryptoFor(token, Number(s.state.amount_due_usd));
    const address = `DEMO-${coin.chain.toUpperCase()}-ADDRESS-DO-NOT-PAY`;
    const tag = token === 'XRP' ? Math.floor(Math.random() * 90000) + 10000 : undefined;
    s.state = {
      ...s.state,
      token,
      chain: coin.chain,
      token_options: undefined,
      network: `${coin.network} (demo)`,
      token_name: coin.name,
      deposit_address: address,
      destination_tag: tag,
      qr_payload: `payitgo-demo:${token}?amount=${amount}${tag ? `&dt=${tag}` : ''}`,
      crypto_amount: amount,
      expires_at: new Date(Date.now() + PAY_MS).toISOString(),
      network_fee_note: 'Demo checkout: nothing is sent or received.',
      confirmations_required: Math.min(coin.confirmations, 12),
    };
    return advance(s);
  },

  simulatePayment(checkoutToken) {
    const s = sessions.get(checkoutToken);
    if (s && !s.paidAt) s.paidAt = Date.now();
  },
};
