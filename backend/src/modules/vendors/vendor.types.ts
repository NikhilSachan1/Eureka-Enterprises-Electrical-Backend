/**
 * Vendor-related type definitions
 */

export interface VendorStats {
  totalSites: number;
  activeSites: number;
  upcomingSites: number;
  completedSites: number;
  holdSites: number;
  totalPos: number;
  totalPoAmount: number;
  totalInvoicedAmount: number;
  totalPaidAmount: number;
}

export interface OverallVendorStats {
  totalVendors: number;
  activeVendors: number;
  inactiveVendors: number;
  archivedVendors: number;
  freelancerVendors: number;
  gstRegisteredVendors: number;
}
