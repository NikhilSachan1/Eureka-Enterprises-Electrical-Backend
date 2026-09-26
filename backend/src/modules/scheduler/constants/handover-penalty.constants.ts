/**
 * Asset / vehicle handover auto-penalty.
 *
 * When a handover is initiated and the receiver neither accepts, rejects nor cancels it within the
 * configured window, the system penalises the receiver and assigns the item to them anyway.
 */

/**
 * Expense category each penalty is booked under. Both are seeded into `expense_categories`.
 *
 * One category per module, not one shared "Asset Penalty": the expense list filters by category,
 * so a vehicle penalty filed under "Asset Penalty" could neither be filtered out nor filtered for,
 * and read as the wrong thing in any listing.
 */
export const HANDOVER_PENALTY_CATEGORIES = {
  ASSET: 'asset_penalty',
  VEHICLE: 'vehicle_penalty',
} as const;

/** Goes on the expense's `approvalReason`, and distinguishes the two modules in reporting. */
export const HANDOVER_PENALTY_REFERENCE_TYPES = {
  ASSET: 'ASSET_HANDOVER_AUTO_PENALTY',
  VEHICLE: 'VEHICLE_HANDOVER_AUTO_PENALTY',
} as const;

/**
 * Used only when the config row is missing or unreadable. `enabled: false` is deliberate — a
 * missing config must never start charging people by accident.
 */
export const HANDOVER_PENALTY_DEFAULTS = {
  enabled: false,
  hours: 48,
  amount: 500,
  modules: { asset: true, vehicle: true },
};

export interface HandoverPenaltyConfig {
  enabled: boolean;
  hours: number;
  amount: number;
  modules: { asset: boolean; vehicle: boolean };
}

/**
 * The description is the only thing most people will read about the charge, so it names the item,
 * the window, and what the person failed to do.
 */
export const buildHandoverPenaltyDescription = (params: {
  amount: number;
  hours: number;
  itemLabel: string;
  identifier?: string | null;
  employeeArchived?: boolean;
}): string => {
  const { amount, hours, itemLabel, identifier, employeeArchived } = params;
  const named = identifier ? `${itemLabel} (${identifier})` : itemLabel;
  const archivedNote = employeeArchived
    ? ' Employee is archived — raised for the record; settle it during full and final.'
    : '';
  return (
    `₹${amount.toLocaleString('en-IN')} penalty — the handover of ${named} was neither accepted, ` +
    `rejected nor cancelled within ${hours} hours, so it was assigned automatically.${archivedNote}`
  );
};
