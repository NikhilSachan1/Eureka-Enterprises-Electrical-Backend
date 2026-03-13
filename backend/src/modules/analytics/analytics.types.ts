/**
 * Analytics Module Type Definitions
 * Comprehensive type definitions for all analytics responses
 */

// ==================== EXECUTIVE DASHBOARD TYPES ====================

/**
 * Executive dashboard summary response
 */
export interface ExecutiveDashboardResponse {
  summary: DashboardSummary;
  sitesByStatus: StatusCount[];
  financialOverview: FinancialOverview;
  alerts: DashboardAlerts;
}

export interface DashboardSummary {
  totalActiveSites: number;
  totalSites: number;
  totalCompanies: number;
  totalContractors: number;
  totalEmployees: number;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface FinancialOverview {
  totalRevenue: number;
  totalExpenses: number;
  netProfitLoss: number;
  profitMarginPercent: number;
  totalPendingReceivables: number;
  totalPendingPayables: number;
}

export interface DashboardAlerts {
  upcomingDeadlines: number;
  overdueInvoices: number;
  overduePayments: number;
  sitesAtRisk: number;
}

// ==================== SITE PROFITABILITY TYPES ====================

/**
 * Single site profitability details
 */
export interface SiteProfitabilityResponse {
  site: SiteBasicInfo;
  revenue: RevenueBreakdown;
  expenses: ExpenseBreakdown;
  profitability: ProfitabilityMetrics;
  documentSummary: DocumentSummary;
}

export interface SiteBasicInfo {
  id: string;
  name: string;
  companyName: string;
  status: string;
  startDate: string;
  endDate: string | null;
  durationDays: number;
}

export interface RevenueBreakdown {
  totalPOValue: number;
  totalInvoiced: number;
  pendingToInvoice: number;
  collectedAmount: number;
  pendingCollection: number;
  collectionRate: number;
}

export interface ExpenseBreakdown {
  total: number;
  contractorExpenses: number;
  employeeExpenses: number;
  fuelExpenses: number;
  payrollCosts: number;
  byCategory: CategoryAmount[];
  byContractor: ContractorExpense[];
}

export interface CategoryAmount {
  category: string;
  amount: number;
  percentage: number;
}

export interface ContractorExpense {
  contractorId: string;
  contractorName: string;
  amount: number;
  paidAmount: number;
  pendingAmount: number;
}

export interface ProfitabilityMetrics {
  grossProfit: number;
  profitMarginPercent: number;
  revenuePerDay: number;
  expensePerDay: number;
  profitPerDay: number;
}

export interface DocumentSummary {
  totalDocuments: number;
  byType: { type: string; count: number }[];
  byStatus: { status: string; count: number }[];
}

/**
 * All sites profitability comparison
 */
export interface AllSitesProfitabilityResponse {
  sites: SiteProfitabilitySummary[];
  totals: ProfitabilityTotals;
}

export interface SiteProfitabilitySummary {
  siteId: string;
  siteName: string;
  companyName: string;
  status: string;
  totalRevenue: number;
  totalExpenses: number;
  profit: number;
  profitMarginPercent: number;
  durationDays: number;
}

export interface ProfitabilityTotals {
  totalRevenue: number;
  totalExpenses: number;
  totalProfit: number;
  avgProfitMargin: number;
  siteCount: number;
}

// ==================== INVOICE AGING TYPES ====================

/**
 * Invoice aging report response
 */
export interface InvoiceAgingResponse {
  direction: 'RECEIVABLE' | 'PAYABLE';
  aging: AgingBucket[];
  summary: AgingSummary;
}

export interface AgingBucket {
  bucket: string;
  daysRange: string;
  count: number;
  totalAmount: number;
  documents: AgingDocument[];
}

export interface AgingDocument {
  id: string;
  documentNumber: string;
  siteName: string;
  contractorName: string | null;
  amount: number;
  dueDate: string;
  daysOverdue: number;
  paymentStatus: string;
}

export interface AgingSummary {
  totalOverdue: number;
  totalOverdueAmount: number;
  avgDaysOverdue: number;
  oldestOverdueDays: number;
}

// ==================== CONTRACTOR PERFORMANCE TYPES ====================

/**
 * Single contractor analytics
 */
export interface ContractorAnalyticsResponse {
  contractor: ContractorBasicInfo;
  siteMetrics: ContractorSiteMetrics;
  financials: ContractorFinancials;
  sites: ContractorSiteDetail[];
}

export interface ContractorBasicInfo {
  id: string;
  name: string;
  contactNumber: string | null;
  email: string | null;
  city: string | null;
  fullAddress: string | null;
}

export interface ContractorSiteMetrics {
  totalSites: number;
  completedSites: number;
  ongoingSites: number;
  upcomingSites: number;
  avgSiteDurationDays: number;
  onTimeCompletionRate: number;
}

export interface ContractorFinancials {
  totalContractValue: number;
  totalPaid: number;
  pendingPayment: number;
  paymentCompletionRate: number;
}

export interface ContractorSiteDetail {
  siteId: string;
  siteName: string;
  status: string;
  startDate: string;
  endDate: string | null;
  contractValue: number;
  paidAmount: number;
  pendingAmount: number;
}

/**
 * All contractors comparison
 */
export interface AllContractorsAnalyticsResponse {
  contractors: ContractorSummary[];
  totals: ContractorTotals;
}

export interface ContractorSummary {
  id: string;
  name: string;
  totalSites: number;
  completedSites: number;
  ongoingSites: number;
  totalContractValue: number;
  pendingPayment: number;
  onTimeRate: number;
}

export interface ContractorTotals {
  totalContractors: number;
  totalContractValue: number;
  totalPaidAmount: number;
  totalPendingAmount: number;
}

// ==================== EMPLOYEE PRODUCTIVITY TYPES ====================

/**
 * Single employee analytics
 */
export interface EmployeeAnalyticsResponse {
  employee: EmployeeBasicInfo;
  siteMetrics: EmployeeSiteMetrics;
  compliance: EmployeeCompliance;
  vehicleMetrics: EmployeeVehicleMetrics;
  allocations: EmployeeAllocation[];
}

export interface EmployeeBasicInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  dateOfJoining: string;
  employeeStatus: string;
}

export interface EmployeeSiteMetrics {
  totalSitesWorked: number;
  currentSite: { id: string; name: string } | null;
  totalDaysWorked: number;
  avgDaysPerSite: number;
}

export interface EmployeeCompliance {
  dailyReportsSubmitted: number;
  reportingCompliancePercent: number;
  vehicleLogsSubmitted: number;
  vehicleLogCompliancePercent: number;
}

export interface EmployeeVehicleMetrics {
  totalKmDriven: number;
  anomaliesCount: number;
  anomalyRate: number;
  avgDailyKm: number;
}

export interface EmployeeAllocation {
  siteId: string;
  siteName: string;
  allocatedAt: string;
  deallocatedAt: string | null;
  isCurrentlyAllocated: boolean;
  daysWorked: number;
}

// ==================== VEHICLE ANALYTICS TYPES ====================

/**
 * Single vehicle analytics
 */
export interface VehicleAnalyticsResponse {
  vehicle: VehicleBasicInfo;
  usage: VehicleUsageMetrics;
  anomalies: VehicleAnomalyMetrics;
  maintenance: VehicleMaintenanceInfo;
  monthlyBreakdown: MonthlyVehicleData[];
}

export interface VehicleBasicInfo {
  id: string;
  registrationNo: string;
  brand: string;
  model: string;
  fuelType: string;
  status: string;
  assignedTo: { id: string; name: string } | null;
}

export interface VehicleUsageMetrics {
  totalLogs: number;
  totalKmTraveled: number;
  avgDailyKm: number;
  expectedDailyKm: number | null;
  kmVariancePercent: number | null;
  daysWithLogs: number;
  firstLogDate: string | null;
  lastLogDate: string | null;
}

export interface VehicleAnomalyMetrics {
  totalCount: number;
  anomalyRatePercent: number;
  recentAnomalies: RecentAnomaly[];
}

export interface RecentAnomaly {
  date: string;
  kmTraveled: number;
  expectedKm: number | null;
  reason: string | null;
  siteName: string | null;
}

export interface VehicleMaintenanceInfo {
  lastServiceDate: string | null;
  lastServiceKm: number | null;
  kmSinceLastService: number;
  nextServiceDueKm: number | null;
}

export interface MonthlyVehicleData {
  month: string;
  year: number;
  totalKm: number;
  logsCount: number;
  anomalies: number;
  avgDailyKm: number;
}

/**
 * Fleet overview
 */
export interface FleetOverviewResponse {
  summary: FleetSummary;
  vehicles: VehicleSummary[];
  alerts: FleetAlerts;
}

export interface FleetSummary {
  totalVehicles: number;
  assigned: number;
  available: number;
  underMaintenance: number;
}

export interface VehicleSummary {
  id: string;
  registrationNo: string;
  brand: string;
  model: string;
  status: string;
  assignedTo: string | null;
  assignedToName: string | null;
  totalKmThisMonth: number;
  anomalyCount: number;
  lastLogDate: string | null;
}

export interface FleetAlerts {
  highAnomalyVehicles: { id: string; registrationNo: string; anomalyRate: number }[];
  noRecentLogs: {
    id: string;
    registrationNo: string;
    lastLogDate: string | null;
    daysSinceLog: number;
  }[];
  serviceDue: { id: string; registrationNo: string; kmSinceService: number }[];
}

// ==================== SITE HEALTH SCORE TYPES ====================

/**
 * Site health score response
 */
export interface SiteHealthResponse {
  siteId: string;
  siteName: string;
  healthScore: number;
  healthGrade: 'A' | 'B' | 'C' | 'D';
  components: HealthComponents;
  recommendations: string[];
  trend: HealthTrend[];
}

export interface HealthComponents {
  timelineAdherence: HealthComponent;
  paymentCollection: HealthComponent;
  workProgress: HealthComponent;
  documentCompletion: HealthComponent;
  dailyReporting: HealthComponent;
}

export interface HealthComponent {
  score: number;
  weight: number;
  weightedScore: number;
  details: string;
}

export interface HealthTrend {
  date: string;
  score: number;
}

// ==================== SITE TIMELINE TYPES ====================

/**
 * Site timeline response
 */
export interface SiteTimelineResponse {
  siteId: string;
  siteName: string;
  currentStatus: string;
  startDate: string;
  expectedEndDate: string | null;
  daysElapsed: number;
  daysRemaining: number | null;
  completionPercent: number;
  timeline: TimelineEvent[];
}

export interface TimelineEvent {
  id: string;
  date: string;
  time: string;
  eventType: string;
  title: string;
  description: string;
  actor: string | null;
  metadata?: Record<string, any>;
}

// ==================== COMMON FILTER TYPES ====================

export interface DateRangeFilter {
  startDate?: string;
  endDate?: string;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface SortParams {
  sortField?: string;
  sortOrder?: 'ASC' | 'DESC';
}
