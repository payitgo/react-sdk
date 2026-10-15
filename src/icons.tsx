// Tiny inline icons so the widget has no icon-library dependency
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

export const CloseIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" {...base}><path d="M18 6 6 18M6 6l12 12" /></svg>;
export const CheckIcon = ({ size = 16 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" {...base}><path d="M20 6 9 17l-5-5" /></svg>;
export const ClockIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" {...base}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
export const SpinnerIcon = () => <svg className="payitgo-spin" width="28" height="28" viewBox="0 0 24 24" {...base}><path d="M21 12a9 9 0 1 1-6.2-8.56" /></svg>;
export const AlertIcon = () => <svg width="26" height="26" viewBox="0 0 24 24" {...base}><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16.5v.01" /></svg>;
