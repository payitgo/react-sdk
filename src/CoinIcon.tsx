import { coinFor } from './coins.js';

export function CoinIcon({ token, size = 30 }: { token: string; size?: number }) {
  const coin = coinFor(token);
  return (
    <span aria-hidden className="payitgo-coin" style={{ width: size, height: size, background: coin.color, fontSize: size * 0.48 }}>
      {coin.glyph}
      {coin.chainBadge && (
        <span className="payitgo-coin-badge" style={{ background: coin.chainBadge.color }}>{coin.chainBadge.glyph}</span>
      )}
    </span>
  );
}
