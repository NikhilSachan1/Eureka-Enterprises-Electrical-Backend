import { Controller, Get, Query, Request, ForbiddenException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { GetDashboardDto } from './dto/dashboard.dto';

@ApiTags('Dashboard')
@ApiBearerAuth('JWT-auth')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

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
    this.assertAdminAccess(req);
    return await this.dashboardService.getOverview();
  }

  @Get('alerts')
  @ApiOperation({
    summary: 'Get top alerts (cards, vehicle docs, vehicle service, asset calibration/warranty)',
  })
  async getAlerts(@Request() req: any) {
    this.assertAdminAccess(req);
    return await this.dashboardService.getAlerts();
  }

  @Get('approvals')
  @ApiOperation({ summary: 'Get pending approvals (leave, attendance, expense, fuel)' })
  async getApprovals(@Request() req: any) {
    this.assertAdminAccess(req);
    return await this.dashboardService.getApprovals();
  }

  @Get('attendance-summary')
  @ApiOperation({ summary: "Get today's attendance summary (present, absent, leave, etc.)" })
  async getAttendanceSummary(@Request() req: any) {
    this.assertAdminAccess(req);
    return await this.dashboardService.getAttendance();
  }

  @Get('leave-summary')
  @ApiOperation({ summary: 'Get leave summary (pending approvals, current month leaves, upcoming)' })
  async getLeaveSummary(@Query() query: GetDashboardDto, @Request() req: any) {
    this.assertAdminAccess(req);
    const dateRange = this.dashboardService.getDateRange(query);
    return await this.dashboardService.getLeave(dateRange);
  }

  @Get('expense-summary')
  @ApiOperation({ summary: 'Get expense summary (totals, categories, top spenders)' })
  async getExpenseSummary(@Query() query: GetDashboardDto, @Request() req: any) {
    this.assertAdminAccess(req);
    const dateRange = this.dashboardService.getDateRange(query);
    return await this.dashboardService.getExpenses(dateRange);
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

  // ==================== Helpers ====================

  private assertAdminAccess(req: any): void {
    const userRole = req?.user?.activeRole || req?.user?.roles?.[0];
    if (!this.dashboardService.isAdminRole(userRole)) {
      throw new ForbiddenException('Access denied. Admin/Manager/HR role required.');
    }
  }
}
