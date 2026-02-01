/**
 * Type definitions for site module
 */

// Overall site statistics (aggregate counts)
export interface OverallSiteStats {
  totalSites: number;
  upcomingSites: number;
  ongoingSites: number;
  holdSites: number;
  completedSites: number;
  activeSites: number;
  inactiveSites: number;
}
