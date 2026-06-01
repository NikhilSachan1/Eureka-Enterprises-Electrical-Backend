import { Controller, Get, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

// Service
import { AnalyticsService } from './analytics.service';

// DTOs
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

// Constants
import { ANALYTICS_RESPONSES } from './constants/analytics.constants';

/**
 * Analytics Controller
 * Provides comprehensive analytics endpoints for business intelligence
 *
 * Endpoints:
 * - Executive Dashboard: High-level overview of all operations
 * - Site Profitability: Revenue, expenses, and profit analysis per site
 * - Invoice Aging: Payment collection and overdue tracking
 * - Contractor Performance: Contractor-wise analytics
 * - Employee Productivity: Employee-wise work metrics
 * - Vehicle Analytics: Fleet usage and anomaly tracking
 * - Site Health: Health score calculation for sites
 * - Site Timeline: Chronological event tracking for sites
 */
@ApiTags('Analytics')
@ApiBearerAuth('JWT-auth')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // ==================== EXECUTIVE DASHBOARD ====================

  /**
   * Get executive dashboard with high-level summary
   * Provides overview of sites, financials, and alerts
   */
  @Get('dashboard')
  @ApiOperation({
    summary: 'Get executive dashboard',
    description:
      'Returns high-level summary of all sites, financial overview, and critical alerts. Useful for executive-level reporting and decision making.',
  })
  @ApiResponse({ status: 200, description: ANALYTICS_RESPONSES.DASHBOARD_FETCHED })
  async getExecutiveDashboard(@Query() dto: GetExecutiveDashboardDto) {
    return await this.analyticsService.getExecutiveDashboard(dto);
  }

  // ==================== SITE PROFITABILITY ====================

  /**
   * NEW: Detailed financial breakdown for a site —
   * Operational Expense, Vendor/Contractor Invoice Summaries, Payment Summary, Profitability.
   * Must be declared BEFORE the generic `profitability` route to prevent NestJS ambiguity.
   */
  @Get('profitability/detail')
  @ApiOperation({
    summary: 'Get detailed site financial summary (new format)',
    description:
      'Returns operational expense breakdown (employee-wise, category-wise), vendor and contractor invoice summaries (PO-wise), payment summary (sales vs vendor/contractor), and profitability metrics (revenue, direct cost, profit margin, expense ratio). Requires siteId.',
  })
  async getSiteFinancialDetail(
    @Query('siteId', ParseUUIDPipe) siteId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return await this.analyticsService.getSiteFinancialDetail(siteId, startDate, endDate);
  }

  /**
   * Unified profitability endpoint — filter by siteId, companyId, contractorId, or none (all sites)
   */
  @Get('profitability')
  @ApiOperation({
    summary: 'Profitability — site / company / contractor level',
    description:
      'Returns profitability metrics. Pass siteId for site-level, companyId for company-level, contractorId for contractor-level, or no filter for all sites.',
  })
  async getProfitability(@Query() dto: GetSiteProfitabilityDto) {
    if (dto.siteId) {
      return await this.analyticsService.getSiteProfitability(dto.siteId, dto);
    }
    return await this.analyticsService.getAllSitesProfitability(dto);
  }

  /**
   * Get profitability comparison for all sites
   */
  @Get('sites/profitability')
  @ApiOperation({
    summary: 'Get all sites profitability',
    description:
      'Returns profitability metrics for all sites with filtering and sorting options. Includes revenue, expenses, profit, and margin calculations.',
  })
  @ApiResponse({ status: 200, description: ANALYTICS_RESPONSES.PROFITABILITY_FETCHED })
  async getAllSitesProfitability(@Query() dto: GetSiteProfitabilityDto) {
    return await this.analyticsService.getAllSitesProfitability(dto);
  }

  /**
   * Get detailed profitability for a specific site
   */
  @Get('sites/:siteId/profitability')
  @ApiOperation({
    summary: 'Get site profitability details',
    description:
      'Returns detailed profitability analysis for a specific site including revenue breakdown, expense categories, contractor-wise expenses, and document summary. Supports period-based filtering.',
  })
  @ApiParam({ name: 'siteId', description: 'Site UUID' })
  @ApiResponse({ status: 200, description: ANALYTICS_RESPONSES.PROFITABILITY_FETCHED })
  @ApiResponse({ status: 404, description: 'Site not found' })
  async getSiteProfitability(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Query() dto: GetSiteProfitabilityDto,
  ) {
    return await this.analyticsService.getSiteProfitability(siteId, dto);
  }

  // ==================== INVOICE AGING ====================

  /**
   * Get invoice aging report
   */
  @Get('invoices/aging')
  @ApiOperation({
    summary: 'Get invoice aging report',
    description:
      'Returns invoice aging analysis grouped by buckets (0-30, 31-60, 61-90, 90+ days). Supports filtering by direction (RECEIVABLE/PAYABLE), site, and contractor.',
  })
  @ApiResponse({ status: 200, description: ANALYTICS_RESPONSES.AGING_REPORT_FETCHED })
  async getInvoiceAging(@Query() dto: GetInvoiceAgingDto) {
    return await this.analyticsService.getInvoiceAging(dto);
  }

  // ==================== CONTRACTOR ANALYTICS ====================

  /**
   * Get analytics for all contractors
   */
  @Get('contractors')
  @ApiOperation({
    summary: 'Get all contractors analytics',
    description:
      'Returns performance metrics for all contractors including site counts, contract values, and payment status. Supports search, sorting, and pagination.',
  })
  @ApiResponse({ status: 200, description: ANALYTICS_RESPONSES.CONTRACTOR_ANALYTICS_FETCHED })
  async getAllContractorsAnalytics(@Query() dto: GetContractorAnalyticsDto) {
    return await this.analyticsService.getAllContractorsAnalytics(dto);
  }

  /**
   * Get detailed analytics for a specific contractor
   */
  @Get('contractors/:contractorId')
  @ApiOperation({
    summary: 'Get contractor analytics details',
    description:
      'Returns comprehensive analytics for a specific contractor including site metrics, financial summary, and site-wise breakdown.',
  })
  @ApiParam({ name: 'contractorId', description: 'Contractor UUID' })
  @ApiResponse({ status: 200, description: ANALYTICS_RESPONSES.CONTRACTOR_ANALYTICS_FETCHED })
  @ApiResponse({ status: 404, description: 'Contractor not found' })
  async getContractorAnalytics(@Param('contractorId', ParseUUIDPipe) contractorId: string) {
    return await this.analyticsService.getContractorAnalytics(contractorId);
  }

  // ==================== EMPLOYEE ANALYTICS ====================

  /**
   * Get detailed analytics for a specific employee
   */
  @Get('employees/:employeeId')
  @ApiOperation({
    summary: 'Get employee analytics details',
    description:
      'Returns comprehensive analytics for a specific employee including site allocation history, compliance metrics, and vehicle usage statistics.',
  })
  @ApiParam({ name: 'employeeId', description: 'Employee UUID' })
  @ApiResponse({ status: 200, description: ANALYTICS_RESPONSES.EMPLOYEE_ANALYTICS_FETCHED })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async getEmployeeAnalytics(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query() dto: GetEmployeeAnalyticsDto,
  ) {
    return await this.analyticsService.getEmployeeAnalytics(employeeId, dto);
  }

  // ==================== VEHICLE ANALYTICS ====================

  /**
   * Get fleet overview (all vehicles)
   */
  @Get('vehicles')
  @ApiOperation({
    summary: 'Get fleet overview',
    description:
      'Returns overview of all vehicles including status summary, usage metrics, and alerts for anomalies or missing logs.',
  })
  @ApiResponse({ status: 200, description: ANALYTICS_RESPONSES.VEHICLE_ANALYTICS_FETCHED })
  async getFleetOverview(@Query() dto: GetVehicleAnalyticsDto) {
    return await this.analyticsService.getFleetOverview(dto);
  }

  /**
   * Get detailed analytics for a specific vehicle
   */
  @Get('vehicles/:vehicleId')
  @ApiOperation({
    summary: 'Get vehicle analytics details',
    description:
      'Returns comprehensive analytics for a specific vehicle including usage metrics, anomaly tracking, maintenance info, and monthly breakdown.',
  })
  @ApiParam({ name: 'vehicleId', description: 'Vehicle Master UUID' })
  @ApiResponse({ status: 200, description: ANALYTICS_RESPONSES.VEHICLE_ANALYTICS_FETCHED })
  @ApiResponse({ status: 404, description: 'Vehicle not found' })
  async getVehicleAnalytics(
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Query() dto: GetVehicleAnalyticsDto,
  ) {
    return await this.analyticsService.getVehicleAnalytics(vehicleId, dto);
  }

  // ==================== SITE HEALTH SCORE ====================

  /**
   * Get health score for a specific site
   */
  @Get('sites/:siteId/health')
  @ApiOperation({
    summary: 'Get site health score',
    description:
      'Returns calculated health score for a site based on timeline adherence, payment collection, work progress, document completion, and daily reporting compliance. Includes recommendations for improvement.',
  })
  @ApiParam({ name: 'siteId', description: 'Site UUID' })
  @ApiResponse({ status: 200, description: ANALYTICS_RESPONSES.HEALTH_SCORE_FETCHED })
  @ApiResponse({ status: 404, description: 'Site not found' })
  async getSiteHealth(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Query() dto: GetSiteHealthDto,
  ) {
    return await this.analyticsService.getSiteHealth(siteId, dto);
  }

  // ==================== SITE TIMELINE ====================

  /**
   * Get timeline of events for a specific site
   */
  @Get('sites/:siteId/timeline')
  @ApiOperation({
    summary: 'Get site timeline',
    description:
      'Returns chronological list of all events for a site including status changes, contractor assignments, employee allocations, and document uploads. Useful for tracking site history and progress.',
  })
  @ApiParam({ name: 'siteId', description: 'Site UUID' })
  @ApiResponse({ status: 200, description: ANALYTICS_RESPONSES.TIMELINE_FETCHED })
  @ApiResponse({ status: 404, description: 'Site not found' })
  async getSiteTimeline(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Query() dto: GetSiteTimelineDto,
  ) {
    return await this.analyticsService.getSiteTimeline(siteId, dto);
  }
}
