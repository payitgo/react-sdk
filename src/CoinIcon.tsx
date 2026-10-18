import { useState } from 'react';
import { coinFor } from './coins.js';

/**
 * A coin's icon: the gateway's (`icon_url`) when the API gave one and it loads, else drawn from the bundled list.
 * The gateway's image is 34 wide for a 30-wide coin, its badge overhanging as the drawn one's does.
 */
export function CoinIcon({ token, iconUrl, size = 30 }: { token: string; iconUrl?: string; size?: number }) {
  const [failed, setFailed] = useState('');
  if (iconUrl && failed !== iconUrl) {
    return (
      <span aria-hidden className="payitgo-coin" style={{ width: size, height: size }}>
        <img alt="" src={iconUrl} onError={() => setFailed(iconUrl)}
          style={{ position: 'absolute', left: 0, top: 0, width: size * 34 / 30, height: size * 34 / 30 }} />
      </span>
    );
  }
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
