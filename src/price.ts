import { formatMoney } from './coins.js';
import type { PayitgoCheckoutState, PayitgoTokenOption } from './types.js';

/** What the coins to send are worth, in the payment's currency: "≈ $49.23", "≈ 45.50 EUR" */
export const dueLine = (state: PayitgoCheckoutState, due: string): string => `≈ ${formatMoney(due, state.currency)}`;

/** When the customer pays the fees each option has its own amount_due: cheapest network first */
export const sortOptions = (options: PayitgoTokenOption[] | undefined): PayitgoTokenOption[] => {
  const list = options ?? [];
  if (!list.some(o => o.amount_due)) return list;
  return [...list].sort((a, b) => Number(a.amount_due ?? Infinity) - Number(b.amount_due ?? Infinity));
};
