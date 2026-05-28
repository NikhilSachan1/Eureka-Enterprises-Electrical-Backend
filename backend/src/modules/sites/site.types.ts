/**
 * Type definitions for site module
 */

// Allocated employee info for site list
export interface AllocatedEmployee {
  id: string;
  allocationId: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePicture: string | null;
  role: string;
  allocationType: string;
  allocatedAt: string;
}

// Site allocation info including count and employees
export interface SiteAllocationInfo {
  allocatedEmployeeCount: number;
  allocatedEmployees: AllocatedEmployee[];
}

// Overall site statistics (aggregate counts)
export interface OverallSiteStats {
  totalSites: number;
  upcomingSites: number;
  ongoingSites: number;
  holdSites: number;
  workCompletedSites: number;
  completedSites: number;
  activeSites: number;
  inactiveSites: number;
}
