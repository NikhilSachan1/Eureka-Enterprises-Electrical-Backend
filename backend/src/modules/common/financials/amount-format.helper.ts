/**
 * Shared helper — formats an amount for display inside user-facing messages
 * (validation errors, notifications) using Indian digit grouping: ₹1,00,000.00
 *
 * Matches the `₹${n.toLocaleString('en-IN')}` pattern already used across the
 * financial modules, but pins 2 decimals so an amount never reads as rounded
 * when the user has to type it back in exactly.
 */
export function formatInr(amount: number | string | null | undefined): string {
  const value = Number(amount ?? 0);
  if (!Number.isFinite(value)) return '₹0.00';
  return `₹${value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
