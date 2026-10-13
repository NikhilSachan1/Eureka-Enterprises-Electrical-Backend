import { Controller, Get, Param, Query, Request, ForbiddenException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequiredPermission } from 'src/modules/auth/decorators/required-permission.decorator';
import { DashboardService } from './dashboard.service';
import { WorkBoardService } from './work-board.service';
import { GetDashboardDto } from './dto/dashboard.dto';

@ApiTags('Dashboard')
@ApiBearerAuth('JWT-auth')
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly workBoardService: WorkBoardService,
  ) {}

  @Get('mobile')
  @ApiOperation({
    summary: 'Get mobile dashboard data',
    description: `
      Returns a lightweight dashboard for mobile apps with:
      1. Leave balances (current financial year)
      2. Festival banner (next upcoming holiday)
      3. Festivals and holidays list
      4. Announcements (latest 4)
      5. Today's birthdays
      6. Today's work anniversaries
      7. Emergency contacts
    `,
  })
  async getMobileDashboard(@Request() req: any) {
    const userId = req?.user?.id;
    return await this.dashboardService.getMobileDashboard(userId);
  }

  // ==================== Section-wise Endpoints ====================

  @Get('overview')
  @ApiOperation({ summary: 'Get overview stats (employees, attendance, approvals, payroll)' })
  async getOverview(@Request() req: any) {
    return await this.dashboardService.getOverview(this.scopeOf(req));
  }

  @Get('alerts')
  @ApiOperation({
    summary: 'Get top alerts (cards, vehicle docs, vehicle service, asset calibration/warranty)',
  })
  async getAlerts(@Request() req: any) {
    return await this.dashboardService.getAlerts(this.scopeOf(req));
  }

  @Get('approvals')
  @ApiOperation({ summary: 'Get pending approvals (leave, attendance, expense, fuel)' })
  async getApprovals(@Request() req: any) {
    return await this.dashboardService.getApprovals(this.scopeOf(req));
  }

  @Get('attendance-summary')
  @ApiOperation({ summary: "Get today's attendance summary (present, absent, leave, etc.)" })
  async getAttendanceSummary(@Request() req: any) {
    return await this.dashboardService.getAttendance(this.scopeOf(req));
  }

  @Get('leave-summary')
  @ApiOperation({
    summary: 'Get leave summary (pending approvals, current month leaves, upcoming)',
  })
  async getLeaveSummary(@Query() query: GetDashboardDto, @Request() req: any) {
    const dateRange = this.dashboardService.getDateRange(query);
    return await this.dashboardService.getLeave(dateRange, this.scopeOf(req));
  }

  @Get('expense-summary')
  @ApiOperation({ summary: 'Get expense summary (totals, categories, top spenders)' })
  async getExpenseSummary(@Query() query: GetDashboardDto, @Request() req: any) {
    const dateRange = this.dashboardService.getDateRange(query);
    return await this.dashboardService.getExpenses(dateRange, this.scopeOf(req));
  }

  @Get('employees-summary')
  @ApiOperation({ summary: 'Get employees summary (headcount, new joiners, exiting, probation)' })
  async getEmployeesSummary(@Request() req: any) {
    this.assertAdminAccess(req);
    return await this.dashboardService.getEmployees();
  }

  @Get('payroll-summary')
  @ApiOperation({ summary: 'Get payroll summary (current month status and trends)' })
  async getPayrollSummary(@Request() req: any) {
    this.assertAdminAccess(req);
    return await this.dashboardService.getPayroll();
  }

  @Get('birthdays')
  @ApiOperation({ summary: 'Get birthdays (today, this week, this month)' })
  async getBirthdays() {
    return await this.dashboardService.getBirthdays();
  }

  @Get('anniversaries')
  @ApiOperation({ summary: 'Get work anniversaries (today, this week, this month)' })
  async getAnniversaries() {
    return await this.dashboardService.getAnniversaries();
  }

  @Get('festivals')
  @ApiOperation({ summary: 'Get upcoming holidays/festivals' })
  async getFestivals() {
    return await this.dashboardService.getFestivals();
  }

  // ==================== New Endpoints ====================

  @Get('asset-summary')
  @ApiOperation({
    summary: 'Get asset stock counts by status (total, available, assigned, lost, retired)',
  })
  async getAssetSummary(@Request() req: any) {
    return await this.dashboardService.getAssetSummary(this.scopeOf(req));
  }

  @Get('vehicle-summary')
  @ApiOperation({
    summary: 'Get vehicle fleet counts by status (total, available, assigned, retired)',
  })
  async getVehicleSummary(@Request() req: any) {
    return await this.dashboardService.getVehicleSummary(this.scopeOf(req));
  }

  @Get('vehicle-readings')
  @ApiOperation({
    summary: 'Get vehicle reading anomalies and vehicles without recent readings (2+ days)',
  })
  async getVehicleReadings(@Request() req: any) {
    this.assertAdminAccess(req);
    return await this.dashboardService.getVehicleReadings();
  }

  @Get('projects-pipeline')
  @ApiOperation({
    summary:
      'Get project pipeline counts (active/upcoming/onHold/completed) and active projects financial totals',
  })
  async getProjectsPipeline(@Request() req: any) {
    this.assertAdminAccess(req);
    return await this.dashboardService.getProjectsPipeline();
  }

  @Get('ledger-balances')
  @ApiOperation({
    summary: 'Get expense + fuel ledger (approvals, opening/closing, employee-wise pay/collect)',
  })
  async getLedgerBalances(@Request() req: any) {
    this.assertAdminAccess(req);
    return await this.dashboardService.getLedgerBalances();
  }

  @Get('cron-health')
  @ApiOperation({ summary: 'Get cron job health (last run, status, duration per cron)' })
  async getCronHealth(@Request() req: any) {
    this.assertAdminAccess(req);
    return await this.dashboardService.getCronHealth();
  }

  @Get('leave-exhaustion')
  @ApiOperation({
    summary: 'Get employees with leave balance <= 2 days remaining (proactive HR alert)',
  })
  async getLeaveExhaustion(@Request() req: any) {
    this.assertAdminAccess(req);
    return await this.dashboardService.getLeaveExhaustion();
  }

  @Get('payroll-status')
  @ApiOperation({ summary: 'Get current month payroll status (generated/pending/paid)' })
  async getPayrollStatus(@Request() req: any) {
    this.assertAdminAccess(req);
    return await this.dashboardService.getPayrollStatus();
  }

  // ==================== Financial Dashboard (BRD §10 Universal View) ====================

  @Get('financial-approvals')
  @RequiredPermission('financials.universal-view')
  @ApiOperation({
    summary: 'Get pending financial approvals across sites (PO/JMC/Invoice)',
    description:
      'Returns a list of pending financial document approvals for the Universal View dashboard. ' +
      'Gated by the financials.universal-view permission per BRD §10 — accessible to all roles ' +
      'except Employee and Driver (configurable via role-permission mapping).',
  })
  async getFinancialApprovals(
    @Query('siteId') siteId?: string,
    @Query('companyId') companyId?: string,
    @Query('partyType') partyType?: string,
  ) {
    return await this.dashboardService.getFinancialApprovals({ siteId, companyId, partyType });
  }

  @Get('financial-summary')
  @RequiredPermission('financials.universal-view')
  @ApiOperation({
    summary: 'Get cross-site financial summary (PO totals, invoiced, paid)',
    description:
      'Returns aggregated financial data across sites for the Universal View dashboard. ' +
      'Gated by the financials.universal-view permission per BRD §10.',
  })
  async getFinancialSummary(
    @Query('siteId') siteId?: string,
    @Query('companyId') companyId?: string,
    @Query('partyType') partyType?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return await this.dashboardService.getFinancialSummary({
      siteId,
      companyId,
      partyType,
      fromDate,
      toDate,
    });
  }

  // ==================== Work board ====================

  @Get('pending-approvals')
  @ApiOperation({
    summary: 'Every approval queue — what is waiting, and on whom',
    description:
      'One row per queue (POs, JMCs, invoices, book payments, advances, site reports, leave, ' +
      'attendance, expenses, fuel) with how many exist, how many are waiting, how long the ' +
      'oldest has waited, and whether this reader is the one who clears it. `onMe` comes from ' +
      'the role-permission table rather than a list in the code, so it cannot disagree with ' +
      'what the API will actually allow. Payment sheets are reported separately, by the stage ' +
      'they are sitting on: a sheet the Operation Manager has processed shows against ' +
      'HR_REVIEW, which is what makes it appear as pending on HR. Scoped like the rest of the ' +
      'dashboard — an admin reads the company, anyone else reads what they raised.',
  })
  async getPendingApprovals(@Request() req: any) {
    return await this.workBoardService.getPendingApprovals(this.scopeOf(req), req?.user?.id);
  }

  @Get('document-gaps')
  @ApiOperation({
    summary: 'Where the document chain has stopped',
    description:
      'A PO approved with no JMC behind it, a JMC with no invoice, an invoice never booked, a ' +
      'booking never transferred, an advance never settled, and documents with no file ' +
      "uploaded. These are not pending approvals — a pending approval is on somebody's desk " +
      'and appears in the queues above. A gap is something already approved whose next step ' +
      'was never taken, so nobody is holding it and today nobody sees it. `info` is returned ' +
      'apart from `gaps`: part-billing a PO is ordinary, and mixing it in would ' +
      'leave a list nobody reads.',
  })
  async getDocumentGaps(@Request() req: any) {
    return await this.workBoardService.getDocumentGaps(this.scopeOf(req));
  }

  @Get('document-gaps/:key')
  @ApiOperation({
    summary: 'The documents behind one gap',
    description:
      'Document number, site, amount and how many days it has been stuck. Capped; `truncated` ' +
      'says when there are more and the real screen should be used.',
  })
  async getDocumentGapList(@Param() params: { key: string }, @Request() req: any) {
    return await this.workBoardService.getDocumentGapList(params.key, this.scopeOf(req));
  }

  // ==================== Helpers ====================

  private assertAdminAccess(req: any): void {
    const userRole = req?.user?.activeRole || req?.user?.roles?.[0];
    if (!this.dashboardService.isAdminRole(userRole)) {
      throw new ForbiddenException(
        'Access denied. Admin/Manager/HR/Operation Manager role required.',
      );
    }
  }

  /**
   * Who is this dashboard being read for.
   *
   * `null` for a role that is allowed to see the company; the caller's own id for everyone else.
   * There is no way to ask for somebody else's — the id comes from the token and no endpoint takes
   * one — so the same URL is safe for every role, and the front end builds one screen rather than
   * branching on who is logged in.
   */
  private scopeOf(req: any): string | null {
    const userRole = req?.user?.activeRole || req?.user?.roles?.[0];
    return this.dashboardService.isAdminRole(userRole) ? null : req?.user?.id;
  }
}
