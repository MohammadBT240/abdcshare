/** Display symbol for report currencies (stored as ISO codes). */
export function currencySymbol(code: string | null | undefined): string {
  if (code === 'NGN') return '₦';
  if (code === 'USD') return '$';
  return '';
}

export function currencyOptionLabel(code: 'NGN' | 'USD'): string {
  if (code === 'NGN') return '₦  Nigerian Naira';
  return '$  US Dollar';
}

/** Format an amount with currency symbol and thousand separators. */
export function formatReportMoney(
  currency: string | null | undefined,
  amount: string | number | null | undefined,
): string {
  if (amount == null || amount === '') return '—';
  const n = typeof amount === 'number' ? amount : Number(String(amount).replace(/,/g, ''));
  const formatted = Number.isFinite(n)
    ? n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : String(amount);
  const symbol = currencySymbol(currency);
  return symbol ? `${symbol}${formatted}` : formatted;
}
