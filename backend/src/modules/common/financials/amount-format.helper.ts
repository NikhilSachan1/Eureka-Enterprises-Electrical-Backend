/**
 * Shared helper — formats an amount for display inside user-facing messages
 * (validation errors, notifications) using Indian digit grouping: ₹1,00,000.00
 *
 * Matches the `₹${n.toLocaleString('en-IN')}` pattern already used across the
 * financial modules, but pins 2 decimals so an amount never reads as rounded
 * when the user has to type it back in exactly.
 */
/**
 * Rounds a rupee amount to paise. Use it on any sum / difference of amounts before comparing:
 * 69878.40 - 53593 is 16285.399999999994 in floating point, which made an exact-limit entry of
 * 16285.40 look like it exceeded the limit.
 */
export function roundInr(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function formatInr(amount: number | string | null | undefined): string {
  const value = Number(amount ?? 0);
  if (!Number.isFinite(value)) return '₹0.00';
  return `₹${value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
