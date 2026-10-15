import { formatPrice, formatUsd } from './coins.js';
import type { PayitgoCheckoutState, PayitgoTokenOption } from './types.js';

/**
 * The dollars due, next to the merchant's own price when it priced the payment in another currency:
 * "≈ $49.23", "€45.50 · ≈ $49.23", or with the fees passed on "Price €45.50 · you pay ≈ $50.40"
 */
export function dueLine(state: PayitgoCheckoutState, dueUsd: string): string {
  const price = formatPrice(state.price_amount, state.price_currency);
  if (!price) return `≈ ${formatUsd(dueUsd)}`;
  if (state.fees_paid_by_customer && Number(dueUsd) !== Number(state.usd_amount)) return `Price ${price} · you pay ≈ ${formatUsd(dueUsd)}`;
  return `${price} · ≈ ${formatUsd(dueUsd)}`;
}

/** When the customer pays the fees each option has its own amount_due_usd: cheapest network first */
export const sortOptions = (options: PayitgoTokenOption[] | undefined): PayitgoTokenOption[] => {
  const list = options ?? [];
  if (!list.some(o => o.amount_due_usd)) return list;
  return [...list].sort((a, b) => Number(a.amount_due_usd ?? Infinity) - Number(b.amount_due_usd ?? Infinity));
};
