import { Controller, Get, Query, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { GetDashboardDto } from './dto/dashboard.dto';
import { DashboardSection, DashboardPeriod } from './constants/dashboard.constants';

@ApiTags('Dashboard')
@ApiBearerAuth('JWT-auth')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({
    summary: 'Get dashboard data',
    description: `
      Fetches dashboard data based on requested sections and filters.
      
      **Available Sections:**
      - overview: Quick stats (employees, attendance, approvals, payroll)
      - birthdays: Employee birthdays (today/week/month)
      - anniversaries: Work anniversaries (today/week/month)
      - festivals: Upcoming holidays from calendar
      - attendance: Attendance summary and trends
      - leave: Leave summary and approvals
      - payroll: Payroll status and trends
      - expenses: Expense summary
      - alerts: Expiring cards, documents, assets
      - approvals: Pending approvals (leave, attendance, expense)
      - employees: New joiners, exiting, probation
      - team: Manager's team data
      
      **Role-based Access:**
      - ADMIN/HR: All sections
      - MANAGER: Most sections + team section
      - EMPLOYEE: Personal data only
    `,
  })
  @ApiQuery({
    name: 'section',
    required: false,
    enum: DashboardSection,
    description: 'Single section to fetch',
  })
  @ApiQuery({
    name: 'sections',
    required: false,
    type: String,
    description: 'Multiple sections (comma-separated): overview,birthdays,alerts',
  })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: DashboardPeriod,
    description: 'Time period for data',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date for custom period (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date for custom period (YYYY-MM-DD)',
  })
  async getDashboard(@Query() query: GetDashboardDto, @Request() req: any) {
    const userId = req?.user?.id;
    const userRole = req?.user?.activeRole || req?.user?.roles?.[0];

    return await this.dashboardService.getDashboard(query, userId, userRole);
  }
}
