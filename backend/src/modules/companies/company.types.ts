/**
 * Company-related type definitions
 */

// Interface for individual company stats
export interface CompanyStats {
  totalSites: number;
  activeSites: number; // ongoing
  upcomingSites: number;
  completedSites: number;
  holdSites: number;
  activeChildCompanies: number;
  inactiveChildCompanies: number;
  archivedChildCompanies: number;
}

// Interface for overall company stats (aggregate)
export interface OverallCompanyStats {
  totalCompanies: number;
  activeCompanies: number;
  inactiveCompanies: number;
  archivedCompanies: number;
}
