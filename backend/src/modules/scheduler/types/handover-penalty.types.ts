/** One handover that has sat untouched past the window, as the selection query returns it. */
export interface StaleHandoverRow {
  eventId: string;
  itemId: string;
  receiverId: string;
  initiatorId: string | null;
  initiatedAt: Date;
  versionId: string;
  itemLabel: string;
  itemIdentifier: string | null;
  receiverFirstName: string | null;
  receiverLastName: string | null;
  receiverStatus: string | null;
  receiverWhatsappOptIn: boolean | null;
  receiverPhone: string | null;
}

export interface HandoverPenaltyModuleResult {
  scanned: number;
  penalised: number;
  skipped: number;
  penaltyTotal: number;
  errors: string[];
}

/** What the cron writes into its cron-log row. */
export interface HandoverPenaltyResult {
  enabled: boolean;
  hours: number;
  amount: number;
  asset: HandoverPenaltyModuleResult;
  vehicle: HandoverPenaltyModuleResult;
}

export const emptyModuleResult = (): HandoverPenaltyModuleResult => ({
  scanned: 0,
  penalised: 0,
  skipped: 0,
  penaltyTotal: 0,
  errors: [],
});
