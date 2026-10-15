'use client';
import { useState } from 'react';
import { PayitgoCheckout, type PayitgoCheckoutProps } from './PayitgoCheckout.js';

export interface PayitgoButtonProps extends Omit<PayitgoCheckoutProps, 'open' | 'onClose'> {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClose?: () => void;
  disabled?: boolean;
}

/**
 * A button that opens the payitgo checkout. Bring your own styles via className/style.
 *
 * ```tsx
 * const adapter = payitgoCheckout({ createPayment: async () => (await fetch('/orders/42/payitgo', { method: 'POST' }).then(r => r.json())).checkout_token });
 * <PayitgoButton adapter={adapter} payment={{ title: 'Order #42', amount: { value: 49.9, currency: 'USD' } }} onSuccess={showThanks} />
 * ```
 *
 * `onSuccess` is not proof of payment: fulfil the order from the `payment.confirmed` webhook.
 */
export function PayitgoButton({ children = 'Pay with crypto', className, style, onClose, disabled, ...checkout }: PayitgoButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} style={style} disabled={disabled} onClick={() => setOpen(true)}>
        {children}
      </button>
      <PayitgoCheckout {...checkout} open={open} onClose={() => { setOpen(false); onClose?.(); }} />
    </>
  );
}
