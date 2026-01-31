/**
 * Contractor-related type definitions
 */

// Interface for individual contractor stats
export interface ContractorStats {
  totalSites: number;
  activeSites: number;
  upcomingSites: number;
  completedSites: number;
  holdSites: number;
  totalDocuments: number;
  totalInvoices: number;
  totalQuotations: number;
  totalAmountBilled: number;
  pendingPayments: number;
}

// Interface for overall contractor stats (aggregate)
export interface OverallContractorStats {
  totalContractors: number;
  activeContractors: number;
  inactiveContractors: number;
  archivedContractors: number;
  selfContractors: number;
}
