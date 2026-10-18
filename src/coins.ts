// The 16 coins payitgo supports, with what the widget needs to draw them offline. Everything about a coin comes
// from the API (a payment's token_options and fields), its ticker and icon_url included: this list is the
// fallback for a payment without them, and what the demo draws.

export type PayitgoTokenId =
  | 'USDT_TRC20' | 'TRX'
  | 'ETH' | 'USDT_ERC20' | 'USDC_ERC20' | 'DAI_ERC20' | 'SHIB_ERC20' | 'PEPE_ERC20'
  | 'BNB' | 'USDT_BEP20' | 'USDC_BEP20' | 'ETH_BEP20'
  | 'BTC' | 'LTC' | 'DOGE' | 'XRP';

export type PayitgoChain = 'tron' | 'ethereum' | 'bsc' | 'bitcoin' | 'litecoin' | 'dogecoin' | 'xrp';

export interface PayitgoCoin {
  id: PayitgoTokenId;
  /** What people call the coin: "USDT" */
  symbol: string;
  name: string;
  chain: PayitgoChain;
  /** The network as the API names it: the chain alone for its own coin ("Tron" for TRX), with the token standard for
   *  a token on it ("Tron (TRC-20)" for USDT_TRC20) */
  network: string;
  color: string;
  glyph: string;
  /** Small chain badge on the coin icon for tokens that live on another coin's chain */
  chainBadge?: { color: string; glyph: string };
  /** Confirmations that make a deposit final (the payment's confirmations_required is authoritative) */
  confirmations: number;
}

/** A chain's name, as the API gives it for the chain's own coin */
export const CHAIN_NAMES: Record<PayitgoChain, string> = {
  tron: 'Tron',
  ethereum: 'Ethereum',
  bsc: 'BNB Smart Chain',
  bitcoin: 'Bitcoin',
  litecoin: 'Litecoin',
  dogecoin: 'Dogecoin',
  xrp: 'XRP Ledger',
};

/** A token's network: its chain and token standard */
const TOKEN_NETWORK = { tron: 'Tron (TRC-20)', ethereum: 'Ethereum (ERC-20)', bsc: 'BNB Smart Chain (BEP-20)' } as const;

const TRON = { color: '#ef0027', glyph: 'T' };
const ETHEREUM = { color: '#627eea', glyph: 'Ξ' };
const BSC = { color: '#f3ba2f', glyph: 'B' };

export const COINS: PayitgoCoin[] = [
  { id: 'USDT_TRC20', symbol: 'USDT', name: 'Tether', chain: 'tron', network: TOKEN_NETWORK.tron, color: '#26a17b', glyph: '₮', chainBadge: TRON, confirmations: 20 },
  { id: 'TRX', symbol: 'TRX', name: 'TRON', chain: 'tron', network: CHAIN_NAMES.tron, color: '#ef0027', glyph: 'T', confirmations: 20 },
  { id: 'ETH', symbol: 'ETH', name: 'Ethereum', chain: 'ethereum', network: CHAIN_NAMES.ethereum, color: '#627eea', glyph: 'Ξ', confirmations: 12 },
  { id: 'USDT_ERC20', symbol: 'USDT', name: 'Tether', chain: 'ethereum', network: TOKEN_NETWORK.ethereum, color: '#26a17b', glyph: '₮', chainBadge: ETHEREUM, confirmations: 12 },
  { id: 'USDC_ERC20', symbol: 'USDC', name: 'USD Coin', chain: 'ethereum', network: TOKEN_NETWORK.ethereum, color: '#2775ca', glyph: '$', chainBadge: ETHEREUM, confirmations: 12 },
  { id: 'DAI_ERC20', symbol: 'DAI', name: 'Dai', chain: 'ethereum', network: TOKEN_NETWORK.ethereum, color: '#f5ac37', glyph: 'D', chainBadge: ETHEREUM, confirmations: 12 },
  { id: 'SHIB_ERC20', symbol: 'SHIB', name: 'Shiba Inu', chain: 'ethereum', network: TOKEN_NETWORK.ethereum, color: '#e42d04', glyph: 'S', chainBadge: ETHEREUM, confirmations: 12 },
  { id: 'PEPE_ERC20', symbol: 'PEPE', name: 'Pepe', chain: 'ethereum', network: TOKEN_NETWORK.ethereum, color: '#4c9540', glyph: 'P', chainBadge: ETHEREUM, confirmations: 12 },
  { id: 'BNB', symbol: 'BNB', name: 'BNB', chain: 'bsc', network: CHAIN_NAMES.bsc, color: '#f3ba2f', glyph: 'B', confirmations: 12 },
  { id: 'USDT_BEP20', symbol: 'USDT', name: 'Tether', chain: 'bsc', network: TOKEN_NETWORK.bsc, color: '#26a17b', glyph: '₮', chainBadge: BSC, confirmations: 12 },
  { id: 'USDC_BEP20', symbol: 'USDC', name: 'USD Coin', chain: 'bsc', network: TOKEN_NETWORK.bsc, color: '#2775ca', glyph: '$', chainBadge: BSC, confirmations: 12 },
  { id: 'ETH_BEP20', symbol: 'ETH', name: 'Ethereum', chain: 'bsc', network: TOKEN_NETWORK.bsc, color: '#627eea', glyph: 'Ξ', chainBadge: BSC, confirmations: 12 },
  { id: 'BTC', symbol: 'BTC', name: 'Bitcoin', chain: 'bitcoin', network: CHAIN_NAMES.bitcoin, color: '#f7931a', glyph: '₿', confirmations: 3 },
  { id: 'LTC', symbol: 'LTC', name: 'Litecoin', chain: 'litecoin', network: CHAIN_NAMES.litecoin, color: '#345d9d', glyph: 'Ł', confirmations: 6 },
  { id: 'DOGE', symbol: 'DOGE', name: 'Dogecoin', chain: 'dogecoin', network: CHAIN_NAMES.dogecoin, color: '#c2a633', glyph: 'Ð', confirmations: 6 },
  { id: 'XRP', symbol: 'XRP', name: 'XRP', chain: 'xrp', network: CHAIN_NAMES.xrp, color: '#23292f', glyph: 'X', confirmations: 1 },
];

const byId = new Map<string, PayitgoCoin>(COINS.map(c => [c.id, c]));

/** Metadata for a token id; unknown ids get a neutral fallback so a new coin never breaks the widget */
export function coinFor(id: string): PayitgoCoin {
  return byId.get(id) ?? { id: id as PayitgoTokenId, symbol: id.split('_')[0] || id, name: id, chain: 'ethereum', network: '', color: '#64748b', glyph: (id[0] ?? '?'), confirmations: 0 };
}

/** What people call the payment's coin: the API's `token_ticker`, else this list's */
export const tickerOf = (s: { token: string; token_ticker?: string }) => s.token_ticker || coinFor(s.token).symbol;

export const formatUsd = (v: number | string) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return (Number.isFinite(n) ? n : 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

/**
 * The merchant's own price, when the payment was priced in another currency ("€45.50"; display only).
 * "" when there is none; an unknown code falls back to "45.50 XYZ"
 */
export const formatPrice = (amount: string | undefined, currency: string | undefined) => {
  if (!amount || !currency) return '';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.toUpperCase() }).format(Number(amount));
  } catch {
    return `${amount} ${currency.toUpperCase()}`;
  }
};

export const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${String(m).padStart(2, '0')}:${sec}`;
};

const fracDigits = (s: string) => (s.split('.')[1] ?? '').length;
const toScaled = (s: string, scale: number) => {
  const [int, frac = ''] = (s || '0').trim().split('.');
  return BigInt((int || '0') + frac.padEnd(scale, '0'));
};

/** Exact a − b on decimal strings, floored at 0 ("49.9" − "30" = "19.9") */
export function subtractDecimal(a: string, b: string): string {
  const scale = Math.max(fracDigits(a), fracDigits(b));
  let diff = toScaled(a, scale) - toScaled(b, scale);
  if (diff < BigInt(0)) diff = BigInt(0);
  const digits = diff.toString().padStart(scale + 1, '0');
  if (!scale) return digits;
  return `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(/\.?0+$/, '');
}

export const isPositive = (s: string | undefined) => !!s && /[1-9]/.test(s);
