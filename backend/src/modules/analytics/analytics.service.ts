import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  GetExecutiveDashboardDto,
  GetSiteProfitabilityDto,
  GetInvoiceAgingDto,
  GetContractorAnalyticsDto,
  GetEmployeeAnalyticsDto,
  GetVehicleAnalyticsDto,
  GetSiteHealthDto,
  GetSiteTimelineDto,
} from './dto';
import {
  ExecutiveDashboardResponse,
  SiteProfitabilityResponse,
  AllSitesProfitabilityResponse,
  InvoiceAgingResponse,
  AgingBucket,
  ContractorAnalyticsResponse,
  AllContractorsAnalyticsResponse,
  EmployeeAnalyticsResponse,
  VehicleAnalyticsResponse,
  FleetOverviewResponse,
  SiteHealthResponse,
  SiteTimelineResponse,
  HealthComponents,
} from './analytics.types';
import {
  ANALYTICS_ERRORS,
  SITE_HEALTH_WEIGHTS,
  HEALTH_GRADE_THRESHOLDS,
  INVOICE_AGING_BUCKETS,
  AnalyticsPeriod,
} from './constants/analytics.constants';
import * as queries from './queries/analytics.queries';
import { UtilityService } from 'src/utils/utility/utility.service';
import { DateTimeService } from 'src/utils/datetime/datetime.service';

/**
 * Analytics Service
 * Handles all analytics calculations and data aggregation
 * Uses raw SQL queries for optimal performance on large datasets
 *
 * TIMEZONE HANDLING:
 * - All date calculations use DateTimeService for consistency
 * - SQL queries use timezone-aware comparisons where applicable
 * - Default timezone is UTC if not specified
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly utilityService: UtilityService,
    private readonly dateTimeService: DateTimeService,
  ) {}

  // ==================== EXECUTIVE DASHBOARD ====================

  /**
   * Get executive dashboard summary
   * Provides high-level overview of all sites, financials, and alerts
   */
  async getExecutiveDashboard(dto: GetExecutiveDashboardDto): Promise<ExecutiveDashboardResponse> {
    try {
      // Calculate date range from period or use provided dates
      const dateRange = this.getDateRange(dto.period, dto.startDate, dto.endDate);

      // Execute all queries in parallel for performance
      const [summaryResult, statusResult, financialResult, alertsResult] = await Promise.all([
        this.executeQuery(queries.getExecutiveSummaryQuery(dto.companyId)),
        this.executeQuery(queries.getSitesByStatusQuery(dto.companyId)),
        this.executeQuery(
          queries.getFinancialOverviewQuery(dto.companyId, dateRange.startDate, dateRange.endDate),
        ),
        this.executeQuery(queries.getDashboardAlertsQuery(dto.companyId)),
      ]);

      const summary = summaryResult[0] || {};
      const financial = financialResult[0] || {};
      const alerts = alertsResult[0] || {};

      // Calculate profit metrics
      const totalRevenue = parseFloat(financial.totalRevenue) || 0;
      const totalExpenses = parseFloat(financial.totalExpenses) || 0;
      const netProfitLoss = totalRevenue - totalExpenses;
      const profitMarginPercent =
        totalRevenue > 0 ? Math.round((netProfitLoss / totalRevenue) * 100 * 100) / 100 : 0;

      return {
        summary: {
          totalActiveSites: parseInt(summary.activeSites) || 0,
          totalSites: parseInt(summary.totalSites) || 0,
          totalCompanies: parseInt(summary.totalCompanies) || 0,
          totalContractors: parseInt(summary.totalContractors) || 0,
          totalEmployees: parseInt(summary.totalEmployees) || 0,
        },
        sitesByStatus: statusResult.map((row: any) => ({
          status: row.status,
          count: parseInt(row.count) || 0,
        })),
        financialOverview: {
          totalRevenue,
          totalExpenses,
          netProfitLoss,
          profitMarginPercent,
          totalPendingReceivables: parseFloat(financial.pendingReceivables) || 0,
          totalPendingPayables: parseFloat(financial.pendingPayables) || 0,
        },
        alerts: {
          upcomingDeadlines: parseInt(alerts.upcomingDeadlines) || 0,
          overdueInvoices: parseInt(alerts.overdueInvoices) || 0,
          overduePayments: parseInt(alerts.overduePayments) || 0,
          sitesAtRisk: 0, // TODO: Implement based on health score
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get executive dashboard: ${error.message}`, error.stack);
      throw error;
    }
  }

  // ==================== SITE PROFITABILITY ====================

  /**
   * Get profitability analysis for a single site
   */
  async getSiteProfitability(
    siteId: string,
    dto?: GetSiteProfitabilityDto,
  ): Promise<SiteProfitabilityResponse> {
    // Calculate date range from period or use provided dates
    const dateRange = dto
      ? this.getDateRange(dto.period, dto.startDate, dto.endDate)
      : { startDate: null, endDate: null };

    // Get main profitability data
    const mainResult = await this.executeQuery(
      queries.getSiteProfitabilityQuery(siteId, dateRange.startDate, dateRange.endDate),
    );

    if (!mainResult.length) {
      throw new NotFoundException(ANALYTICS_ERRORS.SITE_NOT_FOUND);
    }

    const main = mainResult[0];

    const [
      categoryResult,
      employeeCategoryResult,
      contractorResult,
      fuelByVehicleResult,
      payrollByEmployeeResult,
      documentResult,
      trendResult,
    ] = await Promise.all([
      this.executeQuery(
        queries.getSiteExpensesByCategoryQuery(siteId, dateRange.startDate, dateRange.endDate),
      ),
      this.executeQuery(
        queries.getSiteEmployeeExpensesByCategoryQuery(
          siteId,
          dateRange.startDate,
          dateRange.endDate,
        ),
      ),
      this.executeQuery(
        queries.getSiteExpensesByContractorQuery(siteId, dateRange.startDate, dateRange.endDate),
      ),
      this.executeQuery(
        queries.getSiteFuelExpensesByVehicleQuery(siteId, dateRange.startDate, dateRange.endDate),
      ),
      this.executeQuery(
        queries.getSitePayrollByEmployeeQuery(siteId, dateRange.startDate, dateRange.endDate),
      ),
      this.executeQuery(queries.getSiteDocumentSummaryQuery(siteId)),
      this.executeQuery(
        queries.getSiteMonthlyTrendQuery(siteId, dateRange.startDate, dateRange.endDate),
      ),
    ]);

    // Parse financial values
    const totalRevenue = parseFloat(main.totalRevenue) || 0;
    const totalInvoiced = parseFloat(main.totalInvoiced) || 0;
    const totalInvoicedCount = parseInt(main.totalInvoicedCount) || 0;
    const totalPOValue = parseFloat(main.totalPOValue) || 0;
    const collectedAmount = parseFloat(main.collectedAmount) || 0;
    const durationDays = parseInt(main.durationDays) || 1;

    // Parse expense breakdown
    const contractorExpenses = parseFloat(main.contractorExpenses) || 0;
    const employeeExpenses = parseFloat(main.employeeExpenses) || 0;
    const fuelExpenses = parseFloat(main.fuelExpenses) || 0;
    const payrollCosts = parseFloat(main.payrollCosts) || 0;
    const totalExpenses = contractorExpenses + employeeExpenses + fuelExpenses + payrollCosts;

    // Calculate derived metrics
    const grossProfit = totalRevenue - totalExpenses;
    const profitMarginPercent =
      totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 100 * 100) / 100 : 0;
    const collectionRate =
      totalRevenue > 0 ? Math.round((collectedAmount / totalRevenue) * 100 * 100) / 100 : 0;

    // Process expense categories from site documents
    const totalCategoryExpenseAmount = categoryResult.reduce(
      (sum: number, cat: any) => sum + (parseFloat(cat.amount) || 0),
      0,
    );

    const expensesByCategory = categoryResult.map((cat: any) => ({
      category: cat.category,
      amount: parseFloat(cat.amount) || 0,
      percentage:
        totalCategoryExpenseAmount > 0
          ? Math.round(((parseFloat(cat.amount) || 0) / totalCategoryExpenseAmount) * 100 * 100) /
            100
          : 0,
      count: parseInt(cat.count, 10) || 0,
    }));

    const totalEmployeeCategoryAmount = employeeCategoryResult.reduce(
      (sum: number, row: any) => sum + (parseFloat(row.amount) || 0),
      0,
    );
    const employeeExpensesByCategory = employeeCategoryResult.map((row: any) => ({
      category: row.category,
      amount: parseFloat(row.amount) || 0,
      percentage:
        totalEmployeeCategoryAmount > 0
          ? Math.round(((parseFloat(row.amount) || 0) / totalEmployeeCategoryAmount) * 100 * 100) /
            100
          : 0,
      count: parseInt(row.count, 10) || 0,
    }));

    const payrollByEmployee = payrollByEmployeeResult.map((row: any) => ({
      userId: row.userId,
      employeeName: row.employeeName || '',
      amount: parseFloat(row.amount) || 0,
      percentage:
        payrollCosts > 0
          ? Math.round(((parseFloat(row.amount) || 0) / payrollCosts) * 100 * 100) / 100
          : 0,
    }));

    const fuelExpensesByVehicle = fuelByVehicleResult.map((row: any) => ({
      vehicleId: row.vehicleId,
      vehicleLabel: row.vehicleLabel || 'Unknown',
      amount: parseFloat(row.amount) || 0,
      percentage:
        fuelExpenses > 0
          ? Math.round(((parseFloat(row.amount) || 0) / fuelExpenses) * 100 * 100) / 100
          : 0,
      count: parseInt(row.count, 10) || 0,
    }));

    // Process contractor expenses
    const expensesByContractor = contractorResult.map((con: any) => ({
      contractorId: con.contractorId,
      contractorName: con.contractorName,
      amount: parseFloat(con.amount) || 0,
      paidAmount: parseFloat(con.paidAmount) || 0,
      pendingAmount: parseFloat(con.pendingAmount) || 0,
    }));

    // Process document summary
    const byType: { type: string; count: number }[] = [];
    const byStatus: { status: string; count: number }[] = [];

    for (const doc of documentResult) {
      if (doc.groupType === 'by_type') {
        byType.push({ type: doc.groupValue, count: parseInt(doc.count) || 0 });
      } else {
        byStatus.push({ status: doc.groupValue, count: parseInt(doc.count) || 0 });
      }
    }

    // Build expense breakdown for pie chart
    const expenseBreakdown: { category: string; amount: number; percentage: number }[] = [];
    if (totalExpenses > 0) {
      if (contractorExpenses > 0) {
        expenseBreakdown.push({
          category: 'Contractor',
          amount: contractorExpenses,
          percentage: Math.round((contractorExpenses / totalExpenses) * 100 * 100) / 100,
        });
      }
      if (employeeExpenses > 0) {
        expenseBreakdown.push({
          category: 'Employee',
          amount: employeeExpenses,
          percentage: Math.round((employeeExpenses / totalExpenses) * 100 * 100) / 100,
        });
      }
      if (fuelExpenses > 0) {
        expenseBreakdown.push({
          category: 'Fuel',
          amount: fuelExpenses,
          percentage: Math.round((fuelExpenses / totalExpenses) * 100 * 100) / 100,
        });
      }
      if (payrollCosts > 0) {
        expenseBreakdown.push({
          category: 'Payroll',
          amount: payrollCosts,
          percentage: Math.round((payrollCosts / totalExpenses) * 100 * 100) / 100,
        });
      }
    }

    // Process monthly trend data
    const monthlyTrend = trendResult.map((row: any) => ({
      month: row.month,
      monthLabel: row.monthLabel,
      revenue: parseFloat(row.revenue) || 0,
      contractorExpenses: parseFloat(row.contractorExpenses) || 0,
      employeeExpenses: parseFloat(row.employeeExpenses) || 0,
      fuelExpenses: parseFloat(row.fuelExpenses) || 0,
      payrollCosts: parseFloat(row.payrollCosts) || 0,
      totalExpenses: parseFloat(row.totalExpenses) || 0,
      profit: parseFloat(row.profit) || 0,
    }));

    return {
      site: {
        id: main.siteId,
        name: main.siteName,
        companyName: main.companyName,
        status: main.status,
        startDate: main.startDate,
        endDate: main.endDate,
        durationDays,
      },
      revenue: {
        totalPOValue,
        totalInvoiced,
        totalInvoicedCount,
        pendingToInvoice: totalPOValue - totalInvoiced,
        collectedAmount,
        pendingCollection: totalRevenue - collectedAmount,
        collectionRate,
      },
      expenses: {
        total: totalExpenses,
        contractorExpenses,
        employeeExpenses,
        fuelExpenses,
        payrollCosts,
        breakdown: expenseBreakdown,
        byCategory: expensesByCategory,
        employeeExpensesByCategory,
        byContractor: expensesByContractor,
        payrollByEmployee,
        fuelExpensesByVehicle,
      },
      profitability: {
        grossProfit,
        profitMarginPercent,
        revenuePerDay: durationDays > 0 ? Math.round(totalRevenue / durationDays) : 0,
        expensePerDay: durationDays > 0 ? Math.round(totalExpenses / durationDays) : 0,
        profitPerDay: durationDays > 0 ? Math.round(grossProfit / durationDays) : 0,
      },
      documentSummary: {
        totalDocuments: parseInt(main.totalDocuments) || 0,
        byType,
        byStatus,
      },
      monthlyTrend,
    };
  }

  /**
   * Get profitability comparison for all sites
   */
  async getAllSitesProfitability(
    dto: GetSiteProfitabilityDto,
  ): Promise<AllSitesProfitabilityResponse> {
    const page = dto.page || 1;
    const pageSize = dto.pageSize || 20;
    const offset = (page - 1) * pageSize;

    // Calculate date range from period or use provided dates
    const dateRange = this.getDateRange(dto.period, dto.startDate, dto.endDate);

    // Get sites and count in parallel
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [sitesResult, _countResult] = await Promise.all([
      this.executeQuery(
        queries.getAllSitesProfitabilityQuery(
          dto.status,
          dto.companyId,
          dto.sortField || 'createdAt',
          dto.sortOrder || 'DESC',
          pageSize,
          offset,
          dateRange.startDate,
          dateRange.endDate,
          dto.siteId,
          dto.contractorId,
        ),
      ),
      this.executeQuery(
        queries.getAllSitesProfitabilityCountQuery(
          dto.status,
          dto.companyId,
          dto.siteId,
          dto.contractorId,
        ),
      ),
    ]);

    // Map results with expense breakdown
    const sites = sitesResult.map((row: any) => ({
      siteId: row.siteId,
      siteName: row.siteName,
      companyName: row.companyName,
      status: row.status,
      startDate: row.startDate,
      endDate: row.endDate,
      totalRevenue: parseFloat(row.totalRevenue) || 0,
      contractorExpenses: parseFloat(row.contractorExpenses) || 0,
      employeeExpenses: parseFloat(row.employeeExpenses) || 0,
      fuelExpenses: parseFloat(row.fuelExpenses) || 0,
      payrollCosts: parseFloat(row.payrollCosts) || 0,
      totalExpenses: parseFloat(row.totalExpenses) || 0,
      profit: parseFloat(row.profit) || 0,
      profitMarginPercent: parseFloat(row.profitMarginPercent) || 0,
      durationDays: parseInt(row.durationDays) || 0,
    }));

    // Calculate totals with expense breakdown
    const totals = sites.reduce(
      (acc, site) => ({
        totalRevenue: acc.totalRevenue + site.totalRevenue,
        contractorExpenses: acc.contractorExpenses + site.contractorExpenses,
        employeeExpenses: acc.employeeExpenses + site.employeeExpenses,
        fuelExpenses: acc.fuelExpenses + site.fuelExpenses,
        payrollCosts: acc.payrollCosts + site.payrollCosts,
        totalExpenses: acc.totalExpenses + site.totalExpenses,
        totalProfit: acc.totalProfit + site.profit,
        siteCount: acc.siteCount + 1,
      }),
      {
        totalRevenue: 0,
        contractorExpenses: 0,
        employeeExpenses: 0,
        fuelExpenses: 0,
        payrollCosts: 0,
        totalExpenses: 0,
        totalProfit: 0,
        siteCount: 0,
      },
    );

    const avgProfitMargin =
      totals.totalRevenue > 0
        ? Math.round((totals.totalProfit / totals.totalRevenue) * 100 * 100) / 100
        : 0;

    return {
      sites,
      totals: {
        ...totals,
        avgProfitMargin,
      },
    };
  }

  // ==================== INVOICE AGING ====================

  /**
   * Get invoice aging report
   */
  async getInvoiceAging(dto: GetInvoiceAgingDto): Promise<InvoiceAgingResponse> {
    const page = dto.page || 1;
    const pageSize = dto.pageSize || 100;
    const offset = (page - 1) * pageSize;

    // Get documents and summary in parallel
    const [documentsResult, summaryResult] = await Promise.all([
      this.executeQuery(
        queries.getInvoiceAgingQuery(
          dto.direction,
          dto.siteId,
          dto.contractorId,
          dto.overdueOnly,
          pageSize,
          offset,
        ),
      ),
      this.executeQuery(
        queries.getInvoiceAgingSummaryQuery(dto.direction, dto.siteId, dto.contractorId),
      ),
    ]);

    // Group documents by bucket
    const bucketMap: Record<string, AgingBucket> = {
      '0-30': {
        bucket: '0-30',
        daysRange: INVOICE_AGING_BUCKETS.CURRENT.label,
        count: 0,
        totalAmount: 0,
        documents: [],
      },
      '31-60': {
        bucket: '31-60',
        daysRange: INVOICE_AGING_BUCKETS.DAYS_31_60.label,
        count: 0,
        totalAmount: 0,
        documents: [],
      },
      '61-90': {
        bucket: '61-90',
        daysRange: INVOICE_AGING_BUCKETS.DAYS_61_90.label,
        count: 0,
        totalAmount: 0,
        documents: [],
      },
      '90+': {
        bucket: '90+',
        daysRange: INVOICE_AGING_BUCKETS.OVERDUE_90_PLUS.label,
        count: 0,
        totalAmount: 0,
        documents: [],
      },
    };

    // Populate buckets from summary
    for (const row of summaryResult) {
      if (bucketMap[row.bucket]) {
        bucketMap[row.bucket].count = parseInt(row.count) || 0;
        bucketMap[row.bucket].totalAmount = parseFloat(row.totalAmount) || 0;
      }
    }

    // Add documents to buckets
    for (const doc of documentsResult) {
      if (bucketMap[doc.bucket]) {
        bucketMap[doc.bucket].documents.push({
          id: doc.id,
          documentNumber: doc.documentNumber,
          siteName: doc.siteName,
          contractorName: doc.contractorName,
          amount: parseFloat(doc.amount) || 0,
          dueDate: doc.dueDate,
          daysOverdue: parseInt(doc.daysOverdue) || 0,
          paymentStatus: doc.paymentStatus,
        });
      }
    }

    // Calculate summary
    const aging = Object.values(bucketMap);
    const totalOverdue = aging
      .filter((b) => b.bucket !== '0-30')
      .reduce((sum, b) => sum + b.count, 0);
    const totalOverdueAmount = aging
      .filter((b) => b.bucket !== '0-30')
      .reduce((sum, b) => sum + b.totalAmount, 0);
    const allOverdueDays = documentsResult
      .filter((d: any) => parseInt(d.daysOverdue) > 0)
      .map((d: any) => parseInt(d.daysOverdue));
    const avgDaysOverdue =
      allOverdueDays.length > 0
        ? Math.round(
            allOverdueDays.reduce((a: number, b: number) => a + b, 0) / allOverdueDays.length,
          )
        : 0;
    const oldestOverdueDays = allOverdueDays.length > 0 ? Math.max(...allOverdueDays) : 0;

    return {
      direction: dto.direction,
      aging,
      summary: {
        totalOverdue,
        totalOverdueAmount,
        avgDaysOverdue,
        oldestOverdueDays,
      },
    };
  }

  // ==================== CONTRACTOR ANALYTICS ====================

  /**
   * Get analytics for a single contractor
   */
  async getContractorAnalytics(contractorId: string): Promise<ContractorAnalyticsResponse> {
    // Get contractor data and sites in parallel
    const [contractorResult, sitesResult] = await Promise.all([
      this.executeQuery(queries.getContractorAnalyticsQuery(contractorId)),
      this.executeQuery(queries.getContractorSitesQuery(contractorId)),
    ]);

    if (!contractorResult.length) {
      throw new NotFoundException(ANALYTICS_ERRORS.CONTRACTOR_NOT_FOUND);
    }

    const data = contractorResult[0];
    const totalPaid = parseFloat(data.totalPaid) || 0;
    const totalContractValue = parseFloat(data.totalContractValue) || 0;

    // Calculate on-time completion rate
    const completedSites = parseInt(data.completedSites) || 0;
    // For now, assume all completed sites are on-time (can be enhanced later)
    const onTimeCompletionRate = completedSites > 0 ? 100 : 0;

    return {
      contractor: {
        id: data.id,
        name: data.name,
        contactNumber: data.contactNumber,
        email: data.email,
        city: data.city,
        fullAddress: data.fullAddress,
      },
      siteMetrics: {
        totalSites: parseInt(data.totalSites) || 0,
        completedSites,
        ongoingSites: parseInt(data.ongoingSites) || 0,
        upcomingSites: parseInt(data.upcomingSites) || 0,
        avgSiteDurationDays: parseFloat(data.avgSiteDurationDays) || 0,
        onTimeCompletionRate,
      },
      financials: {
        totalContractValue,
        totalPaid,
        pendingPayment: totalContractValue - totalPaid,
        paymentCompletionRate:
          totalContractValue > 0
            ? Math.round((totalPaid / totalContractValue) * 100 * 100) / 100
            : 0,
      },
      sites: sitesResult.map((site: any) => ({
        siteId: site.siteId,
        siteName: site.siteName,
        status: site.status,
        startDate: site.startDate,
        endDate: site.endDate,
        contractValue: parseFloat(site.contractValue) || 0,
        paidAmount: parseFloat(site.paidAmount) || 0,
        pendingAmount: (parseFloat(site.contractValue) || 0) - (parseFloat(site.paidAmount) || 0),
      })),
    };
  }

  /**
   * Get analytics for all contractors
   */
  async getAllContractorsAnalytics(
    dto: GetContractorAnalyticsDto,
  ): Promise<AllContractorsAnalyticsResponse> {
    const page = dto.page || 1;
    const pageSize = dto.pageSize || 20;
    const offset = (page - 1) * pageSize;

    const result = await this.executeQuery(
      queries.getAllContractorsAnalyticsQuery(
        dto.search,
        dto.sortField || 'name',
        dto.sortOrder || 'ASC',
        pageSize,
        offset,
      ),
    );

    const contractors = result.map((row: any) => ({
      id: row.id,
      name: row.name,
      totalSites: parseInt(row.totalSites) || 0,
      completedSites: parseInt(row.completedSites) || 0,
      ongoingSites: parseInt(row.ongoingSites) || 0,
      totalContractValue: parseFloat(row.totalContractValue) || 0,
      pendingPayment: parseFloat(row.pendingPayment) || 0,
      onTimeRate: 100, // Placeholder - can be enhanced
    }));

    // Calculate totals
    const totals = contractors.reduce(
      (acc, c) => ({
        totalContractors: acc.totalContractors + 1,
        totalContractValue: acc.totalContractValue + c.totalContractValue,
        totalPaidAmount: acc.totalPaidAmount + (c.totalContractValue - c.pendingPayment),
        totalPendingAmount: acc.totalPendingAmount + c.pendingPayment,
      }),
      { totalContractors: 0, totalContractValue: 0, totalPaidAmount: 0, totalPendingAmount: 0 },
    );

    return { contractors, totals };
  }

  // ==================== EMPLOYEE ANALYTICS ====================

  /**
   * Get analytics for a single employee
   */
  async getEmployeeAnalytics(
    employeeId: string,
    dto?: GetEmployeeAnalyticsDto,
  ): Promise<EmployeeAnalyticsResponse> {
    // Calculate date range from period or use provided dates
    const dateRange = dto
      ? this.getDateRange(dto.period, dto.startDate, dto.endDate)
      : { startDate: null, endDate: null };

    // Get employee data and allocations in parallel
    const [employeeResult, allocationsResult] = await Promise.all([
      this.executeQuery(
        queries.getEmployeeAnalyticsQuery(employeeId, dateRange.startDate, dateRange.endDate),
      ),
      this.executeQuery(queries.getEmployeeAllocationsQuery(employeeId)),
    ]);

    if (!employeeResult.length) {
      throw new NotFoundException(ANALYTICS_ERRORS.EMPLOYEE_NOT_FOUND);
    }

    const data = employeeResult[0];
    const totalSitesWorked = parseInt(data.totalSitesWorked) || 0;
    const totalDaysWorked = parseInt(data.totalDaysWorked) || 0;
    const dailyReportsSubmitted = parseInt(data.dailyReportsSubmitted) || 0;
    const vehicleLogsSubmitted = parseInt(data.vehicleLogsSubmitted) || 0;
    const totalKmDriven = parseFloat(data.totalKmDriven) || 0;
    const anomaliesCount = parseInt(data.anomaliesCount) || 0;

    // Calculate compliance rates
    // Assuming reports should be submitted for each working day at sites
    const reportingCompliancePercent =
      totalDaysWorked > 0
        ? Math.min(100, Math.round((dailyReportsSubmitted / totalDaysWorked) * 100 * 100) / 100)
        : 0;
    const vehicleLogCompliancePercent =
      totalDaysWorked > 0
        ? Math.min(100, Math.round((vehicleLogsSubmitted / totalDaysWorked) * 100 * 100) / 100)
        : 0;

    return {
      employee: {
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role,
        dateOfJoining: data.dateOfJoining,
        employeeStatus: data.employeeStatus,
      },
      siteMetrics: {
        totalSitesWorked,
        currentSite: data.currentSiteId
          ? { id: data.currentSiteId, name: data.currentSiteName }
          : null,
        totalDaysWorked,
        avgDaysPerSite: totalSitesWorked > 0 ? Math.round(totalDaysWorked / totalSitesWorked) : 0,
      },
      compliance: {
        dailyReportsSubmitted,
        reportingCompliancePercent,
        vehicleLogsSubmitted,
        vehicleLogCompliancePercent,
      },
      vehicleMetrics: {
        totalKmDriven,
        anomaliesCount,
        anomalyRate:
          vehicleLogsSubmitted > 0
            ? Math.round((anomaliesCount / vehicleLogsSubmitted) * 100 * 100) / 100
            : 0,
        avgDailyKm: vehicleLogsSubmitted > 0 ? Math.round(totalKmDriven / vehicleLogsSubmitted) : 0,
      },
      allocations: allocationsResult.map((alloc: any) => ({
        siteId: alloc.siteId,
        siteName: alloc.siteName,
        allocatedAt: alloc.allocatedAt,
        deallocatedAt: alloc.deallocatedAt,
        isCurrentlyAllocated: alloc.isCurrentlyAllocated,
        daysWorked: parseInt(alloc.daysWorked) || 0,
      })),
    };
  }

  // ==================== VEHICLE ANALYTICS ====================

  /**
   * Get analytics for a single vehicle
   */
  async getVehicleAnalytics(
    vehicleId: string,
    dto?: GetVehicleAnalyticsDto,
  ): Promise<VehicleAnalyticsResponse> {
    // Calculate date range from period or use provided dates
    const dateRange = dto
      ? this.getDateRange(dto.period, dto.startDate, dto.endDate)
      : { startDate: null, endDate: null };

    // Get vehicle data, anomalies, and monthly breakdown in parallel
    const [vehicleResult, anomaliesResult, monthlyResult] = await Promise.all([
      this.executeQuery(
        queries.getVehicleAnalyticsQuery(vehicleId, dateRange.startDate, dateRange.endDate),
      ),
      this.executeQuery(queries.getVehicleRecentAnomaliesQuery(vehicleId, 10)),
      this.executeQuery(queries.getVehicleMonthlyBreakdownQuery(vehicleId, 6)),
    ]);

    if (!vehicleResult.length) {
      throw new NotFoundException(ANALYTICS_ERRORS.VEHICLE_NOT_FOUND);
    }

    const data = vehicleResult[0];
    const totalLogs = parseInt(data.totalLogs) || 0;
    const totalKmTraveled = parseFloat(data.totalKmTraveled) || 0;
    const daysWithLogs = parseInt(data.daysWithLogs) || 0;
    const anomalyCount = parseInt(data.anomalyCount) || 0;
    const lastServiceKm = parseInt(data.lastServiceKm) || 0;

    // Calculate current odometer (approximate based on last log + average)
    const avgDailyKm = daysWithLogs > 0 ? Math.round(totalKmTraveled / daysWithLogs) : 0;
    const kmSinceLastService =
      lastServiceKm > 0
        ? totalKmTraveled // Simplified - would need actual odometer reading
        : 0;

    return {
      vehicle: {
        id: data.id,
        registrationNo: data.registrationNo,
        brand: data.brand,
        model: data.model,
        fuelType: data.fuelType,
        status: data.status,
        assignedTo: data.assignedTo ? { id: data.assignedTo, name: data.assignedToName } : null,
      },
      usage: {
        totalLogs,
        totalKmTraveled,
        avgDailyKm,
        expectedDailyKm: null, // Would need site-level expected KM
        kmVariancePercent: null, // Calculate if expected is available
        daysWithLogs,
        firstLogDate: data.firstLogDate,
        lastLogDate: data.lastLogDate,
      },
      anomalies: {
        totalCount: anomalyCount,
        anomalyRatePercent:
          totalLogs > 0 ? Math.round((anomalyCount / totalLogs) * 100 * 100) / 100 : 0,
        recentAnomalies: anomaliesResult.map((a: any) => ({
          date: a.date,
          kmTraveled: parseInt(a.kmTraveled) || 0,
          expectedKm: a.expectedKm ? parseInt(a.expectedKm) : null,
          reason: a.reason,
          siteName: a.siteName,
        })),
      },
      maintenance: {
        lastServiceDate: data.lastServiceDate,
        lastServiceKm,
        kmSinceLastService,
        nextServiceDueKm: lastServiceKm > 0 ? lastServiceKm + 5000 : null, // Assuming 5000km service interval
      },
      monthlyBreakdown: monthlyResult.map((m: any) => ({
        month: m.month,
        year: parseInt(m.year) || 0,
        totalKm: parseFloat(m.totalKm) || 0,
        logsCount: parseInt(m.logsCount) || 0,
        anomalies: parseInt(m.anomalies) || 0,
        avgDailyKm: parseFloat(m.avgDailyKm) || 0,
      })),
    };
  }

  /**
   * Get fleet overview (all vehicles summary)
   */
  async getFleetOverview(dto: GetVehicleAnalyticsDto): Promise<FleetOverviewResponse> {
    const page = dto.page || 1;
    const pageSize = dto.pageSize || 20;
    const offset = (page - 1) * pageSize;

    // Get fleet data and summary in parallel
    const [vehiclesResult, summaryResult] = await Promise.all([
      this.executeQuery(
        queries.getFleetOverviewQuery(dto.search, dto.status, dto.assignedTo, pageSize, offset),
      ),
      this.executeQuery(queries.getFleetSummaryQuery()),
    ]);

    const summary = summaryResult[0] || {};

    // Identify vehicles with high anomaly rates or no recent logs
    const highAnomalyVehicles = vehiclesResult
      .filter((v: any) => (parseInt(v.anomalyCount) || 0) > 5)
      .map((v: any) => ({
        id: v.id,
        registrationNo: v.registrationNo,
        anomalyRate: parseInt(v.anomalyCount) || 0,
      }));

    // Use timezone-aware current date for accurate "days since" calculations
    const today = this.getCurrentDate();
    const noRecentLogs = vehiclesResult
      .filter((v: any) => {
        if (!v.lastLogDate) return true;
        const daysSince = this.getDaysDifference(v.lastLogDate, today);
        return daysSince > 7;
      })
      .map((v: any) => ({
        id: v.id,
        registrationNo: v.registrationNo,
        lastLogDate: v.lastLogDate,
        daysSinceLog: v.lastLogDate ? this.getDaysDifference(v.lastLogDate, today) : 999,
      }));

    return {
      summary: {
        totalVehicles: parseInt(summary.totalVehicles) || 0,
        assigned: parseInt(summary.assigned) || 0,
        available: parseInt(summary.available) || 0,
        underMaintenance: parseInt(summary.underMaintenance) || 0,
      },
      vehicles: vehiclesResult.map((v: any) => ({
        id: v.id,
        registrationNo: v.registrationNo,
        brand: v.brand,
        model: v.model,
        status: v.status,
        assignedTo: v.assignedTo,
        assignedToName: v.assignedToName,
        totalKmThisMonth: parseFloat(v.totalKmThisMonth) || 0,
        anomalyCount: parseInt(v.anomalyCount) || 0,
        lastLogDate: v.lastLogDate,
      })),
      alerts: {
        highAnomalyVehicles,
        noRecentLogs,
        serviceDue: [], // Would need service tracking implementation
      },
    };
  }

  // ==================== SITE HEALTH SCORE ====================

  /**
   * Calculate and return site health score
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getSiteHealth(siteId: string, _dto: GetSiteHealthDto): Promise<SiteHealthResponse> {
    const result = await this.executeQuery(queries.getSiteHealthDataQuery(siteId));

    if (!result.length) {
      throw new NotFoundException(ANALYTICS_ERRORS.SITE_NOT_FOUND);
    }

    const data = result[0];
    const components = this.calculateHealthComponents(data);
    const healthScore = this.calculateHealthScore(components);
    const healthGrade = this.getHealthGrade(healthScore);
    const recommendations = this.generateRecommendations(components);

    return {
      siteId: data.id,
      siteName: data.name,
      healthScore,
      healthGrade,
      components,
      recommendations,
      trend: [], // TODO: Implement historical trend if includeTrend is true
    };
  }

  /**
   * Calculate individual health components
   */
  private calculateHealthComponents(data: any): HealthComponents {
    const totalDays = parseInt(data.totalDays) || 1;
    const daysElapsed = parseInt(data.daysElapsed) || 0;
    const daysDelayed = parseInt(data.daysDelayed) || 0;
    const totalReceivable = parseFloat(data.totalReceivable) || 0;
    const collectedAmount = parseFloat(data.collectedAmount) || 0;
    const daysWithReports = parseInt(data.daysWithReports) || 0;
    const totalDocuments = parseInt(data.totalDocuments) || 0;

    // Timeline Adherence: 100 - (daysDelayed / totalDays * 100)
    const timelineScore = Math.max(0, Math.min(100, 100 - (daysDelayed / totalDays) * 100));

    // Payment Collection: (collected / receivable) * 100
    const paymentScore =
      totalReceivable > 0 ? Math.min(100, (collectedAmount / totalReceivable) * 100) : 100; // If no receivables, consider it 100%

    // Work Progress: Placeholder - would need actual work completion tracking
    const workProgressScore = 75; // Default placeholder

    // Document Completion: Based on documents uploaded
    // Assuming at least 5 documents expected per site
    const expectedDocs = 5;
    const documentScore = Math.min(100, (totalDocuments / expectedDocs) * 100);

    // Daily Reporting: (daysWithReports / daysElapsed) * 100
    const reportingScore =
      daysElapsed > 0 ? Math.min(100, (daysWithReports / daysElapsed) * 100) : 100;

    return {
      timelineAdherence: {
        score: Math.round(timelineScore),
        weight: SITE_HEALTH_WEIGHTS.TIMELINE_ADHERENCE,
        weightedScore: Math.round((timelineScore * SITE_HEALTH_WEIGHTS.TIMELINE_ADHERENCE) / 100),
        details:
          daysDelayed > 0 ? `Site is ${daysDelayed} days behind schedule` : 'Site is on schedule',
      },
      paymentCollection: {
        score: Math.round(paymentScore),
        weight: SITE_HEALTH_WEIGHTS.PAYMENT_COLLECTION,
        weightedScore: Math.round((paymentScore * SITE_HEALTH_WEIGHTS.PAYMENT_COLLECTION) / 100),
        details: `${Math.round(paymentScore)}% of receivables collected`,
      },
      workProgress: {
        score: Math.round(workProgressScore),
        weight: SITE_HEALTH_WEIGHTS.WORK_PROGRESS,
        weightedScore: Math.round((workProgressScore * SITE_HEALTH_WEIGHTS.WORK_PROGRESS) / 100),
        details: `Work progress at ${Math.round(workProgressScore)}%`,
      },
      documentCompletion: {
        score: Math.round(documentScore),
        weight: SITE_HEALTH_WEIGHTS.DOCUMENT_COMPLETION,
        weightedScore: Math.round((documentScore * SITE_HEALTH_WEIGHTS.DOCUMENT_COMPLETION) / 100),
        details: `${totalDocuments} documents uploaded`,
      },
      dailyReporting: {
        score: Math.round(reportingScore),
        weight: SITE_HEALTH_WEIGHTS.DAILY_REPORTING,
        weightedScore: Math.round((reportingScore * SITE_HEALTH_WEIGHTS.DAILY_REPORTING) / 100),
        details: `Reports submitted for ${daysWithReports}/${daysElapsed} days`,
      },
    };
  }

  /**
   * Calculate overall health score from components
   */
  private calculateHealthScore(components: HealthComponents): number {
    const totalWeightedScore =
      components.timelineAdherence.weightedScore +
      components.paymentCollection.weightedScore +
      components.workProgress.weightedScore +
      components.documentCompletion.weightedScore +
      components.dailyReporting.weightedScore;

    return Math.round(totalWeightedScore);
  }

  /**
   * Get health grade based on score
   */
  private getHealthGrade(score: number): 'A' | 'B' | 'C' | 'D' {
    if (score >= HEALTH_GRADE_THRESHOLDS.A) return 'A';
    if (score >= HEALTH_GRADE_THRESHOLDS.B) return 'B';
    if (score >= HEALTH_GRADE_THRESHOLDS.C) return 'C';
    return 'D';
  }

  /**
   * Generate improvement recommendations based on weak components
   */
  private generateRecommendations(components: HealthComponents): string[] {
    const recommendations: string[] = [];

    if (components.timelineAdherence.score < 70) {
      recommendations.push('Focus on reducing delays to improve timeline adherence');
    }
    if (components.paymentCollection.score < 80) {
      recommendations.push('Follow up on pending receivables to improve cash flow');
    }
    if (components.workProgress.score < 70) {
      recommendations.push('Review work progress and address any blockers');
    }
    if (components.documentCompletion.score < 80) {
      recommendations.push('Ensure all required documents are uploaded');
    }
    if (components.dailyReporting.score < 80) {
      recommendations.push('Improve daily status report compliance');
    }

    if (recommendations.length === 0) {
      recommendations.push('Site is performing well. Keep up the good work!');
    }

    return recommendations;
  }

  // ==================== SITE TIMELINE ====================

  /**
   * Get timeline of events for a site
   */
  async getSiteTimeline(siteId: string, dto: GetSiteTimelineDto): Promise<SiteTimelineResponse> {
    const result = await this.executeQuery(
      queries.getSiteTimelineQuery(
        siteId,
        dto.eventType,
        dto.startDate,
        dto.endDate,
        dto.limit || 50,
      ),
    );

    // Get site basic info
    const siteResult = await this.dataSource.query(
      `SELECT id, name, status, "startDate", "endDate" FROM sites WHERE id = $1 AND "deletedAt" IS NULL`,
      [siteId],
    );

    if (!siteResult.length) {
      throw new NotFoundException(ANALYTICS_ERRORS.SITE_NOT_FOUND);
    }

    const site = siteResult[0];

    // Convert site dates to string format if they're Date objects
    const startDateStr =
      typeof site.startDate === 'string'
        ? site.startDate.split('T')[0] // Handle ISO strings
        : this.dateTimeService.toDateString(site.startDate);
    const endDateStr = site.endDate
      ? typeof site.endDate === 'string'
        ? site.endDate.split('T')[0]
        : this.dateTimeService.toDateString(site.endDate)
      : null;

    // Calculate days using DateTimeService for consistency
    const daysElapsed = this.dateTimeService.getDaysSince(startDateStr);
    const daysRemaining = endDateStr
      ? Math.max(0, this.dateTimeService.getDaysUntil(endDateStr))
      : null;
    const totalDays = endDateStr
      ? this.dateTimeService.getDaysDifference(endDateStr, startDateStr)
      : daysElapsed;
    const completionPercent =
      totalDays > 0 ? Math.min(100, Math.round((daysElapsed / totalDays) * 100)) : 0;

    return {
      siteId: site.id,
      siteName: site.name,
      currentStatus: site.status,
      startDate: site.startDate,
      expectedEndDate: site.endDate,
      daysElapsed,
      daysRemaining,
      completionPercent,
      timeline: result.map((event: any) => ({
        id: event.id,
        date: event.event_date,
        time: event.event_time,
        eventType: event.event_type,
        title: event.title,
        description: event.description,
        actor: event.actor,
      })),
    };
  }

  // ==================== SITE FINANCIAL DETAIL (New Profitability) ====================

  /**
   * GET /analytics/profitability/detail?siteId=
   *
   * Returns:
   *   metaSummary      — SALE PO/invoice totals + PURCHASE PO/invoice totals, per-invoice lists
   *   expenseSummary   — employee cost (payroll), regular expense, fuel expense
   *   paymentSummary   — received vs invoiced (SALE) + paid vs invoiced (PURCHASE)
   *   profitabilitySummary — revenue, project cost, gross/net profit, margins
   */
  async getSiteFinancialDetail(siteId: string, startDate?: string, endDate?: string) {
    try {
      const [
        salePoResult,
        purchasePoResult,
        salesInvoiceListResult,
        purchaseInvoiceListResult,
        payrollByEmployeeResult,
        payrollTotalResult,
        opExpTotalResult,
        opExpByEmpCatResult,
        opExpByCategoryResult,
        fuelTotalResult,
        fuelByEmployeeResult,
        invoiceTotalsResult,
        bankTransferTotalsResult,
      ] = await Promise.all([
        this.executeQuery(queries.getSalesPOSummaryQuery(siteId)),
        this.executeQuery(queries.getPurchasePOSummaryQuery(siteId)),
        this.executeQuery(queries.getSalesInvoiceListQuery(siteId)),
        this.executeQuery(queries.getPurchaseInvoiceListQuery(siteId)),
        this.executeQuery(queries.getSitePayrollByEmployeeDetailQuery(siteId, startDate, endDate)),
        this.executeQuery(queries.getSitePayrollTotalCostQuery(siteId, startDate, endDate)),
        this.executeQuery(queries.getOpExpenseTotalQuery(siteId, startDate, endDate)),
        this.executeQuery(
          queries.getOpExpenseByEmployeeAndCategoryQuery(siteId, startDate, endDate),
        ),
        this.executeQuery(queries.getOpExpenseByCategoryQuery(siteId, startDate, endDate)),
        this.executeQuery(queries.getFuelExpenseTotalQuery(siteId, startDate, endDate)),
        this.executeQuery(queries.getFuelExpenseByEmployeeQuery(siteId, startDate, endDate)),
        this.executeQuery(queries.getInvoiceTotalsBySideQuery(siteId)),
        this.executeQuery(queries.getBankTransferTotalsBySideQuery(siteId)),
      ]);

      // ── PO summaries ─────────────────────────────────────────────────────────
      const salePO = salePoResult[0] || {};
      const purchPO = purchasePoResult[0] || {};

      const totalSalesPOValue = parseFloat(salePO.totalSalesPOValue ?? '0') || 0;
      const totalSalesPOCount = parseInt(salePO.totalSalesPOCount ?? '0') || 0;
      const totalPurchasePOValue = parseFloat(purchPO.totalPurchasePOValue ?? '0') || 0;
      const totalPurchasePOCount = parseInt(purchPO.totalPurchasePOCount ?? '0') || 0;

      // ── Invoice counts / totals ───────────────────────────────────────────────
      const inv = invoiceTotalsResult[0] || {};
      const totalSalesInvoicedAmount = parseFloat(inv.saleTotalInvoiced ?? '0') || 0;
      const totalSalesInvoiceCount = parseInt(inv.salesInvoiceCount ?? '0') || 0;
      const totalVendorInvoicedAmount = parseFloat(inv.purchaseTotalInvoiced ?? '0') || 0;
      const totalVendorInvoiceCount = parseInt(inv.vendorInvoiceCount ?? '0') || 0;

      const salesUnbilledAmount = Math.max(0, totalSalesPOValue - totalSalesInvoicedAmount);
      const pendingVendorBillingAmount = Math.max(
        0,
        totalPurchasePOValue - totalVendorInvoicedAmount,
      );
      const billingCompletionPercentage =
        totalSalesPOValue > 0
          ? Math.round((totalSalesInvoicedAmount / totalSalesPOValue) * 100 * 100) / 100
          : 0;
      const purchaseBillingCompletionPercentage =
        totalPurchasePOValue > 0
          ? Math.round((totalVendorInvoicedAmount / totalPurchasePOValue) * 100 * 100) / 100
          : 0;

      // ── Sales invoice list ────────────────────────────────────────────────────
      const salesInvoiceList = salesInvoiceListResult.map((r: any) => ({
        invoiceNumber: r.invoiceNumber as string,
        invoiceDate: r.invoiceDate as string,
        poNumber: r.poNumber as string,
        clientName: r.clientName as string,
        invoiceAmount: parseFloat(r.invoiceAmount) || 0,
      }));

      // ── Purchase invoice list ─────────────────────────────────────────────────
      const purchaseInvoiceList = purchaseInvoiceListResult.map((r: any) => ({
        invoiceNumber: r.invoiceNumber as string,
        invoiceDate: r.invoiceDate as string,
        poNumber: r.poNumber as string,
        vendorName: r.vendorName as string,
        invoiceAmount: parseFloat(r.invoiceAmount) || 0,
      }));

      // ── Employee cost (payroll) ───────────────────────────────────────────────
      const totalEmployeeCost = parseFloat(payrollTotalResult[0]?.total ?? '0') || 0;

      const employeeCostWise = payrollByEmployeeResult.map((r: any) => {
        const allocatedAmount = parseFloat(r.allocatedAmount) || 0;
        const workingDays = parseInt(r.workingDays) || 0;
        const perDayCost =
          workingDays > 0 ? Math.round((allocatedAmount / workingDays) * 100) / 100 : 0;
        return {
          employeeName: r.employeeName as string,
          employeeCode: r.employeeCode as string,
          workingDays,
          perDayCost,
          allocatedAmount,
        };
      });

      // ── Regular operational expense ───────────────────────────────────────────
      const totalRegularExpense = parseFloat(opExpTotalResult[0]?.total ?? '0') || 0;

      const regularExpenseByEmpCat = opExpByEmpCatResult.map((r: any) => ({
        employeeName: r.employeeName as string,
        employeeCode: r.employeeCode as string,
        expenseType: r.expenseType as string,
        expenseAmount: parseFloat(r.expenseAmount) || 0,
      }));

      const regularExpenseByCategory = opExpByCategoryResult.map((r: any) => ({
        categoryName: r.categoryName as string,
        amount: parseFloat(r.amount) || 0,
      }));

      // ── Fuel expense ──────────────────────────────────────────────────────────
      const totalFuelExpense = parseFloat(fuelTotalResult[0]?.total ?? '0') || 0;

      const fuelByEmployee = fuelByEmployeeResult.map((r: any) => ({
        employeeName: r.employeeName as string,
        employeeCode: r.employeeCode as string,
        vehicleNumber: r.vehicleNumber as string,
        expenseAmount: parseFloat(r.expenseAmount) || 0,
      }));

      const totalOperationalExpense = totalRegularExpense + totalFuelExpense;

      // ── Payment summary ───────────────────────────────────────────────────────
      const bt = bankTransferTotalsResult[0] || {};
      const totalPaymentReceived = parseFloat(bt.saleTransferred ?? '0') || 0;
      const totalPaymentPaid = parseFloat(bt.purchaseTransferred ?? '0') || 0;

      const outstandingReceivableAmount = Math.max(
        0,
        totalSalesInvoicedAmount - totalPaymentReceived,
      );
      const outstandingPayableAmount = Math.max(0, totalVendorInvoicedAmount - totalPaymentPaid);

      // ── Profitability ─────────────────────────────────────────────────────────
      // Revenue = total sales invoiced (what clients owe us)
      const revenue = totalSalesInvoicedAmount;
      const vendorCost = totalVendorInvoicedAmount;
      const employeeCostForProfit = totalEmployeeCost;
      const operationalExpenseForProfit = totalOperationalExpense;

      const totalProjectCost = vendorCost + employeeCostForProfit + operationalExpenseForProfit;
      const grossProfit = revenue - totalProjectCost;
      const netProfit = grossProfit; // same until overhead tracking is added
      const profitMarginPercentage =
        revenue > 0 ? Math.round((netProfit / revenue) * 100 * 100) / 100 : 0;
      const expenseRatioPercentage =
        revenue > 0 ? Math.round((totalProjectCost / revenue) * 100 * 100) / 100 : 0;

      // ── Final response ────────────────────────────────────────────────────────
      return {
        metaSummary: {
          salesSummary: {
            totalSalesPOValue,
            totalSalesPOCount,
            totalSalesInvoicedAmount,
            totalSalesInvoiceCount,
            salesUnbilledAmount,
            billingCompletionPercentage,
            salesInvoiceSummary: {
              totalSalesInvoiceAmount: totalSalesInvoicedAmount,
              invoiceSummary: salesInvoiceList,
            },
          },
          purchaseSummary: {
            totalPurchasePOValue,
            totalPurchasePOCount,
            totalVendorInvoicedAmount,
            totalVendorInvoiceCount,
            pendingVendorBillingAmount,
            purchaseBillingCompletionPercentage,
            vendorInvoiceSummary: {
              totalVendorInvoiceAmount: totalVendorInvoicedAmount,
              invoiceSummary: purchaseInvoiceList,
            },
          },
        },

        expenseSummary: {
          employeeCost: {
            totalEmployeeCost,
            employeeWiseSummary: employeeCostWise,
          },
          operationalExpense: {
            totalOperationalExpense,
            regularExpense: {
              totalRegularExpense,
              employeeWiseSummary: regularExpenseByEmpCat,
              categoryWiseSummary: regularExpenseByCategory,
            },
            fuelExpense: {
              totalFuelExpense,
              employeeWiseSummary: fuelByEmployee,
            },
          },
        },

        paymentSummary: {
          salesPaymentSummary: {
            totalInvoicedAmount: totalSalesInvoicedAmount,
            totalPaymentReceived,
            outstandingReceivableAmount,
          },
          purchasePaymentSummary: {
            totalVendorInvoiceAmount: totalVendorInvoicedAmount,
            totalPaymentPaid,
            outstandingPayableAmount,
          },
        },

        profitabilitySummary: {
          revenue,
          projectCost: {
            vendorCost,
            employeeCost: employeeCostForProfit,
            operationalExpense: operationalExpenseForProfit,
            totalProjectCost,
          },
          grossProfit,
          netProfit,
          profitMarginPercentage,
          expenseRatioPercentage,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get site financial detail: ${error.message}`, error.stack);
      throw error;
    }
  }

  // ==================== HELPER METHODS ====================

  /**
   * Execute a SQL query with error handling
   */
  private async executeQuery(queryDef: { query: string; params: any[] }): Promise<any[]> {
    try {
      return await this.dataSource.query(queryDef.query, queryDef.params);
    } catch (error) {
      this.logger.error(`Query execution failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get date range based on period
   * Uses DateTimeService for timezone-aware date calculations
   *
   * @param period - The period type (TODAY, WEEK, MONTH, etc.)
   * @param startDate - Custom start date (required for CUSTOM period)
   * @param endDate - Custom end date (required for CUSTOM period)
   * @param timezone - Optional timezone (defaults to Asia/Kolkata)
   */
  private getDateRange(
    period?: AnalyticsPeriod,
    startDate?: string,
    endDate?: string,
    timezone?: string,
  ) {
    // If custom dates are provided (with or without period=CUSTOM), use them
    if (startDate && endDate) {
      return { startDate, endDate };
    }

    // If period is CUSTOM but dates are missing, throw error
    if (period === AnalyticsPeriod.CUSTOM) {
      throw new BadRequestException(ANALYTICS_ERRORS.CUSTOM_DATES_REQUIRED);
    }

    // Use DateTimeService for timezone-aware "today"
    const today = this.dateTimeService.getNowInTimezone(timezone);

    // Format date as YYYY-MM-DD string
    const formatDate = (d: Date) => this.dateTimeService.toDateString(d);

    switch (period) {
      case AnalyticsPeriod.TODAY:
        const todayStr = this.dateTimeService.getTodayString(timezone);
        return { startDate: todayStr, endDate: todayStr };

      case AnalyticsPeriod.WEEK:
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return { startDate: formatDate(weekStart), endDate: formatDate(weekEnd) };

      case AnalyticsPeriod.MONTH:
        return {
          startDate: formatDate(new Date(today.getFullYear(), today.getMonth(), 1)),
          endDate: formatDate(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
        };

      case AnalyticsPeriod.QUARTER:
        const quarter = Math.floor(today.getMonth() / 3);
        return {
          startDate: formatDate(new Date(today.getFullYear(), quarter * 3, 1)),
          endDate: formatDate(new Date(today.getFullYear(), quarter * 3 + 3, 0)),
        };

      case AnalyticsPeriod.YEAR:
        return {
          startDate: formatDate(new Date(today.getFullYear(), 0, 1)),
          endDate: formatDate(new Date(today.getFullYear(), 11, 31)),
        };

      case AnalyticsPeriod.ALL_TIME:
      default:
        return { startDate: null, endDate: null };
    }
  }

  /**
   * Calculate days difference between two dates
   * Converts Date objects to strings for DateTimeService compatibility
   *
   * @param fromDate - Start date (Date object or YYYY-MM-DD string)
   * @param toDate - End date (Date object or YYYY-MM-DD string)
   * @returns Number of days between dates (positive if toDate > fromDate)
   */
  private getDaysDifference(fromDate: Date | string, toDate: Date | string): number {
    const fromStr =
      typeof fromDate === 'string' ? fromDate : this.dateTimeService.toDateString(fromDate);
    const toStr = typeof toDate === 'string' ? toDate : this.dateTimeService.toDateString(toDate);

    // getDaysDifference returns (first - second), so we reverse for (to - from)
    return this.dateTimeService.getDaysDifference(toStr, fromStr);
  }

  /**
   * Get current date/time in the specified timezone
   * Useful for "today" comparisons in analytics
   *
   * @param timezone - IANA timezone string (defaults to Asia/Kolkata)
   * @returns Date object representing current time in timezone
   */
  private getCurrentDate(timezone?: string): Date {
    return this.dateTimeService.getNowInTimezone(timezone);
  }

  /**
   * Get today's date string in the specified timezone
   *
   * @param timezone - IANA timezone string (defaults to Asia/Kolkata)
   * @returns Date string in YYYY-MM-DD format
   */
  private getTodayString(timezone?: string): string {
    return this.dateTimeService.getTodayString(timezone);
  }
}
