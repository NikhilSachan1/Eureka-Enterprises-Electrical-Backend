import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { GetDashboardDto } from './dto/dashboard.dto';
import {
  DashboardSection,
  DashboardPeriod,
  DASHBOARD_CONSTANTS,
  DASHBOARD_ERRORS,
  AlertType,
  AlertSeverity,
} from './constants/dashboard.constants';
import {
  DashboardResponse,
  OverviewData,
  BirthdayData,
  AnniversaryData,
  FestivalData,
  AttendanceData,
  LeaveData,
  PayrollData,
  ExpenseData,
  AlertsData,
  ApprovalsData,
  EmployeesData,
  TeamData,
  AlertItem,
  TrendChartData,
  DistributionChartData,
  EmployeeCelebration,
  AnniversaryEmployee,
  Holiday,
} from './dashboard.types';
import * as queries from './queries/dashboard.queries';
import { UtilityService } from 'src/utils/utility/utility.service';
import { DateTimeService } from 'src/utils/datetime/datetime.service';
import { Roles } from '../roles/constants/role.constants';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly utilityService: UtilityService,
    private readonly dateTimeService: DateTimeService,
  ) {}

  async getDashboard(
    query: GetDashboardDto,
    userId: string,
    userRole: string,
  ): Promise<DashboardResponse> {
    const sections = this.determineSections(query);
    const dateRange = this.getDateRange(query);

    const response: DashboardResponse = {};

    // Execute sections in parallel where possible
    const sectionPromises: Promise<void>[] = [];

    for (const section of sections) {
      if (!this.canAccessSection(section, userRole)) {
        continue; // Skip sections user can't access
      }

      switch (section) {
        case DashboardSection.OVERVIEW:
          sectionPromises.push(
            this.getOverview().then((data) => {
              response.overview = data;
            }),
          );
          break;
        case DashboardSection.BIRTHDAYS:
          sectionPromises.push(
            this.getBirthdays().then((data) => {
              response.birthdays = data;
            }),
          );
          break;
        case DashboardSection.ANNIVERSARIES:
          sectionPromises.push(
            this.getAnniversaries().then((data) => {
              response.anniversaries = data;
            }),
          );
          break;
        case DashboardSection.FESTIVALS:
          sectionPromises.push(
            this.getFestivals().then((data) => {
              response.festivals = data;
            }),
          );
          break;
        case DashboardSection.ATTENDANCE:
          sectionPromises.push(
            this.getAttendance().then((data) => {
              response.attendance = data;
            }),
          );
          break;
        case DashboardSection.LEAVE:
          sectionPromises.push(
            this.getLeave(dateRange).then((data) => {
              response.leave = data;
            }),
          );
          break;
        case DashboardSection.PAYROLL:
          sectionPromises.push(
            this.getPayroll().then((data) => {
              response.payroll = data;
            }),
          );
          break;
        case DashboardSection.EXPENSES:
          sectionPromises.push(
            this.getExpenses(dateRange).then((data) => {
              response.expenses = data;
            }),
          );
          break;
        case DashboardSection.ALERTS:
          sectionPromises.push(
            this.getAlerts().then((data) => {
              response.alerts = data;
            }),
          );
          break;
        case DashboardSection.APPROVALS:
          sectionPromises.push(
            this.getApprovals().then((data) => {
              response.approvals = data;
            }),
          );
          break;
        case DashboardSection.EMPLOYEES:
          sectionPromises.push(
            this.getEmployees().then((data) => {
              response.employees = data;
            }),
          );
          break;
        case DashboardSection.TEAM:
          sectionPromises.push(
            this.getTeam().then((data) => {
              response.team = data;
            }),
          );
          break;
      }
    }

    await Promise.all(sectionPromises);

    return response;
  }

  private determineSections(query: GetDashboardDto): DashboardSection[] {
    // If specific section requested
    if (query.section) {
      const section = query.section.toLowerCase() as DashboardSection;
      if (!Object.values(DashboardSection).includes(section)) {
        throw new BadRequestException(
          DASHBOARD_ERRORS.INVALID_SECTION.replace('{section}', query.section),
        );
      }
      return [section];
    }

    // If multiple sections requested
    if (query.sections && query.sections.length > 0) {
      return query.sections.map((s) => {
        const section = s.toLowerCase() as DashboardSection;
        if (!Object.values(DashboardSection).includes(section)) {
          throw new BadRequestException(DASHBOARD_ERRORS.INVALID_SECTION.replace('{section}', s));
        }
        return section;
      });
    }

    // Default: return all sections
    return Object.values(DashboardSection);
  }

  private getDateRange(query: GetDashboardDto): { startDate: string; endDate: string } {
    const today = new Date();

    if (query.period === DashboardPeriod.CUSTOM) {
      if (!query.startDate || !query.endDate) {
        throw new BadRequestException(DASHBOARD_ERRORS.CUSTOM_DATES_REQUIRED);
      }
      return { startDate: query.startDate, endDate: query.endDate };
    }

    const period = query.period || DashboardPeriod.MONTH;

    switch (period) {
      case DashboardPeriod.TODAY:
        return {
          startDate: this.formatDate(today),
          endDate: this.formatDate(today),
        };
      case DashboardPeriod.WEEK:
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return {
          startDate: this.formatDate(weekStart),
          endDate: this.formatDate(weekEnd),
        };
      case DashboardPeriod.MONTH:
        return {
          startDate: this.formatDate(new Date(today.getFullYear(), today.getMonth(), 1)),
          endDate: this.formatDate(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
        };
      case DashboardPeriod.QUARTER:
        const quarter = Math.floor(today.getMonth() / 3);
        return {
          startDate: this.formatDate(new Date(today.getFullYear(), quarter * 3, 1)),
          endDate: this.formatDate(new Date(today.getFullYear(), quarter * 3 + 3, 0)),
        };
      case DashboardPeriod.YEAR:
        return {
          startDate: this.formatDate(new Date(today.getFullYear(), 0, 1)),
          endDate: this.formatDate(new Date(today.getFullYear(), 11, 31)),
        };
      default:
        return {
          startDate: this.formatDate(new Date(today.getFullYear(), today.getMonth(), 1)),
          endDate: this.formatDate(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
        };
    }
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private canAccessSection(section: DashboardSection, userRole: string): boolean {
    const roleAccess: Record<string, DashboardSection[]> = {
      [Roles.ADMIN]: Object.values(DashboardSection),
      [Roles.HR]: Object.values(DashboardSection),
      [Roles.MANAGER]: [
        DashboardSection.OVERVIEW,
        DashboardSection.BIRTHDAYS,
        DashboardSection.ANNIVERSARIES,
        DashboardSection.FESTIVALS,
        DashboardSection.ATTENDANCE,
        DashboardSection.LEAVE,
        DashboardSection.EXPENSES,
        DashboardSection.ALERTS,
        DashboardSection.TEAM,
      ],
      [Roles.EMPLOYEE]: [
        DashboardSection.OVERVIEW,
        DashboardSection.BIRTHDAYS,
        DashboardSection.ANNIVERSARIES,
        DashboardSection.FESTIVALS,
        DashboardSection.ATTENDANCE,
        DashboardSection.LEAVE,
        DashboardSection.PAYROLL,
        DashboardSection.EXPENSES,
      ],
      [Roles.DRIVER]: [
        DashboardSection.OVERVIEW,
        DashboardSection.BIRTHDAYS,
        DashboardSection.ANNIVERSARIES,
        DashboardSection.FESTIVALS,
        DashboardSection.ATTENDANCE,
        DashboardSection.LEAVE,
        DashboardSection.PAYROLL,
        DashboardSection.EXPENSES,
      ],
    };

    const allowedSections = roleAccess[userRole] || [];
    return allowedSections.includes(section);
  }

  // ==================== Section Implementations ====================

  private async getOverview(): Promise<OverviewData> {
    const today = this.formatDate(new Date());
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const [employeeSummary, todayAttendance, pendingApprovals, payrollSummary] = await Promise.all([
      this.executeQuery(queries.getEmployeeSummaryQuery()),
      this.executeQuery(queries.getTodayAttendanceSummaryQuery(today)),
      this.executeQuery(queries.getPendingApprovalsCountQuery()),
      this.executeQuery(queries.getCurrentMonthPayrollSummaryQuery(currentMonth, currentYear)),
    ]);

    const empData = employeeSummary[0] || {};
    const attData = todayAttendance[0] || {};
    const approvalData = pendingApprovals[0] || {};
    const payData = payrollSummary[0] || {};

    return {
      employees: {
        total: empData.total || 0,
        active: empData.active || 0,
        inactive: empData.inactive || 0,
        newThisMonth: empData.newThisMonth || 0,
        exitingThisMonth: empData.exitingThisMonth || 0,
        onProbation: empData.onProbation || 0,
      },
      todayAttendance: {
        present: attData.present || 0,
        absent: attData.absent || 0,
        onLeave: attData.onLeave || 0,
        holiday: attData.holiday || 0,
        notCheckedInYet: attData.notCheckedInYet || 0,
        approvalPending: attData.approvalPending || 0,
        checkedIn: attData.checkedIn || 0,
        checkedOut: attData.checkedOut || 0,
      },
      pendingApprovals: {
        leave: approvalData.leave || 0,
        attendance: approvalData.attendance || 0,
        expense: approvalData.expense || 0,
        total:
          (approvalData.leave || 0) + (approvalData.attendance || 0) + (approvalData.expense || 0),
      },
      currentMonthPayroll: {
        draft: payData.draft || 0,
        generated: payData.generated || 0,
        approved: payData.approved || 0,
        paid: payData.paid || 0,
        cancelled: payData.cancelled || 0,
        totalAmount: parseFloat(payData.totalAmount) || 0,
      },
    };
  }

  private async getBirthdays(): Promise<BirthdayData> {
    const today = new Date();
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + 7);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const { query, params } = queries.getBirthdaysQuery(
      this.formatDate(today),
      this.formatDate(weekEnd),
      this.formatDate(monthEnd),
    );

    const results = await this.dataSource.query(query, params);

    const todayList: EmployeeCelebration[] = [];
    const weekList: EmployeeCelebration[] = [];
    const monthList: EmployeeCelebration[] = [];

    for (const row of results) {
      const item: EmployeeCelebration = {
        userId: row.userId,
        name: row.name,
        email: row.email,
        profilePicture: row.profilePicture,
        date: row.date,
        daysUntil: row.daysUntil,
      };

      if (row.period === 'today') {
        todayList.push(item);
      } else if (row.period === 'week') {
        weekList.push(item);
      } else {
        monthList.push(item);
      }
    }

    return {
      today: todayList,
      thisWeek: weekList,
      thisMonth: monthList,
      counts: {
        today: todayList.length,
        thisWeek: weekList.length,
        thisMonth: monthList.length,
      },
    };
  }

  private async getAnniversaries(): Promise<AnniversaryData> {
    const today = new Date();
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + 7);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const { query, params } = queries.getAnniversariesQuery(
      this.formatDate(today),
      this.formatDate(weekEnd),
      this.formatDate(monthEnd),
    );

    const results = await this.dataSource.query(query, params);

    const todayList: AnniversaryEmployee[] = [];
    const weekList: AnniversaryEmployee[] = [];
    const monthList: AnniversaryEmployee[] = [];

    for (const row of results) {
      const item: AnniversaryEmployee = {
        userId: row.userId,
        name: row.name,
        email: row.email,
        profilePicture: row.profilePicture,
        date: row.date,
        daysUntil: row.daysUntil,
        yearsCompleted: row.yearsCompleted,
      };

      if (row.period === 'today') {
        todayList.push(item);
      } else if (row.period === 'week') {
        weekList.push(item);
      } else {
        monthList.push(item);
      }
    }

    return {
      today: todayList,
      thisWeek: weekList,
      thisMonth: monthList,
      counts: {
        today: todayList.length,
        thisWeek: weekList.length,
        thisMonth: monthList.length,
      },
    };
  }

  private async getFestivals(): Promise<FestivalData> {
    const today = new Date();
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const { query, params } = queries.getHolidaysQuery();

    const result = await this.dataSource.query(query, params);

    const todayList: Holiday[] = [];
    const upcomingList: Holiday[] = [];
    const monthList: Holiday[] = [];

    if (result[0]?.holidays) {
      const holidays = result[0].holidays as Array<{ date: string; name: string; type?: string }>;

      for (const holiday of holidays) {
        const holidayDate = new Date(holiday.date);
        const todayStr = this.formatDate(today);
        const holidayStr = this.formatDate(holidayDate);

        if (holidayDate < today && holidayStr !== todayStr) continue;
        if (holidayDate > monthEnd) continue;

        const daysUntil = Math.ceil(
          (holidayDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );

        const item: Holiday = {
          date: holiday.date,
          name: holiday.name,
          type: holiday.type,
          daysUntil,
        };

        if (holidayStr === todayStr) {
          todayList.push(item);
        }

        if (daysUntil <= 14 && daysUntil >= 0) {
          upcomingList.push(item);
        }

        monthList.push(item);
      }
    }

    return {
      today: todayList,
      upcoming: upcomingList,
      thisMonth: monthList,
      counts: {
        today: todayList.length,
        thisWeek: upcomingList.filter((h) => (h.daysUntil || 0) <= 7).length,
        thisMonth: monthList.length,
      },
    };
  }

  private async getAttendance(): Promise<AttendanceData> {
    const today = this.formatDate(new Date());
    const trendStartDate = new Date();
    trendStartDate.setDate(trendStartDate.getDate() - DASHBOARD_CONSTANTS.DEFAULT_TREND_DAYS);

    const [todayData, trendData] = await Promise.all([
      this.executeQuery(queries.getTodayAttendanceSummaryQuery(today)),
      this.executeQuery(queries.getAttendanceTrendQuery(this.formatDate(trendStartDate), today)),
    ]);

    const att = todayData[0] || {};

    // Build trend chart data
    const trend: TrendChartData = {
      labels: trendData.map((d: any) => d.date),
      datasets: [
        { label: 'Present', data: trendData.map((d: any) => d.present || 0) },
        { label: 'Absent', data: trendData.map((d: any) => d.absent || 0) },
        { label: 'Leave', data: trendData.map((d: any) => d.leave || 0) },
      ],
    };

    // Distribution for today
    const distribution: DistributionChartData = {
      labels: ['Present', 'Absent', 'Leave', 'Holiday'],
      values: [att.present || 0, att.absent || 0, att.onLeave || 0, att.holiday || 0],
    };

    return {
      today: {
        present: att.present || 0,
        absent: att.absent || 0,
        onLeave: att.onLeave || 0,
        holiday: att.holiday || 0,
        halfDay: att.halfDay || 0,
        notCheckedInYet: att.notCheckedInYet || 0,
        approvalPending: att.approvalPending || 0,
        checkedIn: att.checkedIn || 0,
        checkedOut: att.checkedOut || 0,
      },
      currentMonth: {
        totalWorkingDays: 22, // TODO: Calculate from config
        avgPresentPercentage: 0, // TODO: Calculate
        avgAbsentPercentage: 0,
        avgLeavePercentage: 0,
      },
      trend,
      distribution,
      lateArrivals: {
        today: 0, // TODO: Implement late arrivals tracking
        thisWeek: 0,
        thisMonth: 0,
      },
    };
  }

  private async getLeave(dateRange: { startDate: string; endDate: string }): Promise<LeaveData> {
    const today = new Date();
    const upcomingEndDate = new Date();
    upcomingEndDate.setDate(today.getDate() + DASHBOARD_CONSTANTS.DEFAULT_UPCOMING_DAYS);
    const financialYear = this.utilityService.getFinancialYear(today);

    const [leaveSummary, upcomingLeaves, pendingApprovals, balanceOverview] = await Promise.all([
      this.executeQuery(queries.getLeaveSummaryQuery(dateRange.startDate, dateRange.endDate)),
      this.executeQuery(
        queries.getUpcomingLeavesQuery(this.formatDate(today), this.formatDate(upcomingEndDate)),
      ),
      this.executeQuery(queries.getPendingLeaveApprovalsQuery(10)),
      this.executeQuery(queries.getLeaveBalanceOverviewQuery(financialYear)),
    ]);

    // Build leave type distribution
    const byType: Record<string, number> = {};
    let totalLeavesTaken = 0;
    for (const item of leaveSummary) {
      byType[item.leaveCategory] = item.count;
      totalLeavesTaken += item.count;
    }

    // Build balance overview
    const balanceData: Record<string, { allocated: number; consumed: number; balance: number }> =
      {};
    for (const item of balanceOverview) {
      balanceData[item.leaveCategory] = {
        allocated: item.allocated,
        consumed: item.consumed,
        balance: item.balance,
      };
    }

    return {
      pendingApprovals: {
        count: pendingApprovals.length,
        items: pendingApprovals,
      },
      currentMonthSummary: {
        totalLeavesTaken,
        byType,
      },
      upcomingLeaves,
      balanceOverview: balanceData,
      trend: { labels: [], datasets: [] }, // TODO: Implement monthly trend
      distribution: {
        labels: Object.keys(byType),
        values: Object.values(byType),
      },
    };
  }

  private async getPayroll(): Promise<PayrollData> {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    const [currentPayroll, previousPayroll, trendData, deductions] = await Promise.all([
      this.executeQuery(queries.getCurrentMonthPayrollSummaryQuery(currentMonth, currentYear)),
      this.executeQuery(queries.getCurrentMonthPayrollSummaryQuery(prevMonth, prevYear)),
      this.executeQuery(queries.getPayrollTrendQuery(6)),
      this.executeQuery(queries.getPayrollDeductionBreakdownQuery(currentMonth, currentYear)),
    ]);

    const current = currentPayroll[0] || {};
    const previous = previousPayroll[0] || {};
    const deductionData = deductions[0] || {};

    // Build trend chart
    const trend: TrendChartData = {
      labels: trendData.map((d: any) => `${d.month}/${d.year}`),
      datasets: [
        {
          label: 'Gross Earnings',
          data: trendData.map((d: any) => parseFloat(d.grossEarnings) || 0),
        },
        { label: 'Net Payable', data: trendData.map((d: any) => parseFloat(d.netPayable) || 0) },
        {
          label: 'Deductions',
          data: trendData.map((d: any) => parseFloat(d.totalDeductions) || 0),
        },
      ],
    };

    return {
      currentMonth: {
        month: currentMonth,
        year: currentYear,
        status: {
          draft: current.draft || 0,
          generated: current.generated || 0,
          approved: current.approved || 0,
          paid: current.paid || 0,
          cancelled: current.cancelled || 0,
        },
        totalGrossEarnings: parseFloat(current.totalAmount) || 0,
        totalDeductions: 0, // TODO: Add to query
        totalNetPayable: parseFloat(current.totalAmount) || 0,
        totalBonus: 0, // TODO: Add to query
      },
      previousMonth: {
        month: prevMonth,
        year: prevYear,
        status: {
          draft: previous.draft || 0,
          generated: previous.generated || 0,
          approved: previous.approved || 0,
          paid: previous.paid || 0,
          cancelled: previous.cancelled || 0,
        },
        totalGrossEarnings: parseFloat(previous.totalAmount) || 0,
        totalDeductions: 0,
        totalNetPayable: parseFloat(previous.totalAmount) || 0,
        totalBonus: 0,
      },
      trend,
      deductionBreakdown: {
        employeePf: parseFloat(deductionData.employeePf) || 0,
        employerPf: parseFloat(deductionData.employerPf) || 0,
        tds: parseFloat(deductionData.tds) || 0,
        esic: parseFloat(deductionData.esic) || 0,
        professionalTax: parseFloat(deductionData.professionalTax) || 0,
      },
    };
  }

  private async getExpenses(dateRange: {
    startDate: string;
    endDate: string;
  }): Promise<ExpenseData> {
    const [summary, categoryData, topSpenders, pendingApprovals] = await Promise.all([
      this.executeQuery(queries.getExpenseSummaryQuery(dateRange.startDate, dateRange.endDate)),
      this.executeQuery(
        queries.getExpenseCategoryDistributionQuery(dateRange.startDate, dateRange.endDate),
      ),
      this.executeQuery(
        queries.getTopSpendersQuery(
          dateRange.startDate,
          dateRange.endDate,
          DASHBOARD_CONSTANTS.TOP_SPENDERS_LIMIT,
        ),
      ),
      this.executeQuery(queries.getPendingExpenseApprovalsQuery(10)),
    ]);

    const summaryData = summary[0] || {};

    return {
      currentMonth: {
        totalExpenses: parseFloat(summaryData.totalExpenses) || 0,
        totalCredits: parseFloat(summaryData.totalCredits) || 0,
        pendingClaims: parseFloat(summaryData.pendingClaims) || 0,
        approvedClaims: parseFloat(summaryData.approvedClaims) || 0,
        rejectedClaims: parseFloat(summaryData.rejectedClaims) || 0,
      },
      pendingApprovals: {
        count: pendingApprovals.length,
        items: pendingApprovals,
      },
      categoryDistribution: {
        labels: categoryData.map((c: any) => c.category),
        values: categoryData.map((c: any) => parseFloat(c.total) || 0),
      },
      topSpenders: topSpenders.map((s: any) => ({
        userId: s.userId,
        userName: s.userName,
        totalExpense: parseFloat(s.totalExpense) || 0,
      })),
      trend: { labels: [], datasets: [] }, // TODO: Implement monthly trend
    };
  }

  private async getAlerts(): Promise<AlertsData> {
    const today = new Date();
    const warningDate = new Date(today);
    warningDate.setDate(today.getDate() + DASHBOARD_CONSTANTS.ALERT_WARNING_DAYS);
    const infoDate = new Date(today);
    infoDate.setDate(today.getDate() + DASHBOARD_CONSTANTS.ALERT_INFO_DAYS);

    const [cards, vehicleDocs, vehicleService, assetCalibration, assetWarranty] = await Promise.all(
      [
        this.executeQuery(
          queries.getExpiringCardsQuery(this.formatDate(warningDate), this.formatDate(infoDate)),
        ),
        this.executeQuery(
          queries.getExpiringVehicleDocsQuery(
            this.formatDate(warningDate),
            this.formatDate(infoDate),
          ),
        ),
        this.executeQuery(queries.getVehicleServiceDueQuery(1000)),
        this.executeQuery(
          queries.getAssetCalibrationDueQuery(
            this.formatDate(warningDate),
            this.formatDate(infoDate),
          ),
        ),
        this.executeQuery(
          queries.getAssetWarrantyExpiryQuery(
            this.formatDate(warningDate),
            this.formatDate(infoDate),
          ),
        ),
      ],
    );

    const critical: AlertItem[] = [];
    const warning: AlertItem[] = [];
    const info: AlertItem[] = [];

    // Process cards
    let cardExpired = 0,
      cardExpiringSoon = 0;
    for (const card of cards) {
      const alert: AlertItem = {
        type: AlertType.CARD_EXPIRY,
        id: card.id,
        message: `Card ${card.cardNumber} (${card.cardType}) ${
          card.severity === 'expired' ? 'has expired' : 'expiring soon'
        }`,
        severity:
          card.severity === 'expired'
            ? AlertSeverity.CRITICAL
            : card.severity === 'warning'
            ? AlertSeverity.WARNING
            : AlertSeverity.INFO,
        data: card,
      };
      if (card.severity === 'expired') {
        critical.push(alert);
        cardExpired++;
      } else if (card.severity === 'warning') {
        warning.push(alert);
        cardExpiringSoon++;
      } else {
        info.push(alert);
        cardExpiringSoon++;
      }
    }

    // Process vehicle docs
    let vehicleDocExpired = 0,
      vehicleDocExpiringSoon = 0;
    for (const doc of vehicleDocs) {
      const alert: AlertItem = {
        type: AlertType.VEHICLE_DOC_EXPIRY,
        id: doc.id,
        message: `Vehicle ${doc.vehicleNumber} ${doc.documentType} ${
          doc.severity === 'expired' ? 'has expired' : 'expiring soon'
        }`,
        severity:
          doc.severity === 'expired'
            ? AlertSeverity.CRITICAL
            : doc.severity === 'warning'
            ? AlertSeverity.WARNING
            : AlertSeverity.INFO,
        data: doc,
      };
      if (doc.severity === 'expired') {
        critical.push(alert);
        vehicleDocExpired++;
      } else if (doc.severity === 'warning') {
        warning.push(alert);
        vehicleDocExpiringSoon++;
      } else {
        info.push(alert);
        vehicleDocExpiringSoon++;
      }
    }

    // Process vehicle service
    let serviceOverdue = 0,
      serviceDueSoon = 0;
    for (const service of vehicleService) {
      const alert: AlertItem = {
        type: AlertType.VEHICLE_SERVICE_DUE,
        id: service.id,
        message: `Vehicle ${service.vehicleNumber} service ${
          service.severity === 'overdue' ? 'overdue' : 'due soon'
        } (${service.kmSinceLastService} km since last service)`,
        severity:
          service.severity === 'overdue'
            ? AlertSeverity.CRITICAL
            : service.severity === 'warning'
            ? AlertSeverity.WARNING
            : AlertSeverity.INFO,
        data: service,
      };
      if (service.severity === 'overdue') {
        critical.push(alert);
        serviceOverdue++;
      } else if (service.severity === 'warning') {
        warning.push(alert);
        serviceDueSoon++;
      } else {
        info.push(alert);
        serviceDueSoon++;
      }
    }

    // Process asset calibration
    let calibrationOverdue = 0,
      calibrationDueSoon = 0;
    for (const asset of assetCalibration) {
      const alert: AlertItem = {
        type: AlertType.ASSET_CALIBRATION,
        id: asset.id,
        message: `Asset ${asset.assetName} (${asset.assetCode}) calibration ${
          asset.severity === 'overdue' ? 'overdue' : 'due soon'
        }`,
        severity:
          asset.severity === 'overdue'
            ? AlertSeverity.CRITICAL
            : asset.severity === 'warning'
            ? AlertSeverity.WARNING
            : AlertSeverity.INFO,
        data: asset,
      };
      if (asset.severity === 'overdue') {
        critical.push(alert);
        calibrationOverdue++;
      } else if (asset.severity === 'warning') {
        warning.push(alert);
        calibrationDueSoon++;
      } else {
        info.push(alert);
        calibrationDueSoon++;
      }
    }

    // Process asset warranty
    let warrantyExpired = 0,
      warrantyExpiringSoon = 0;
    for (const asset of assetWarranty) {
      const alert: AlertItem = {
        type: AlertType.ASSET_WARRANTY,
        id: asset.id,
        message: `Asset ${asset.assetName} (${asset.assetCode}) warranty ${
          asset.severity === 'expired' ? 'has expired' : 'expiring soon'
        }`,
        severity:
          asset.severity === 'expired'
            ? AlertSeverity.CRITICAL
            : asset.severity === 'warning'
            ? AlertSeverity.WARNING
            : AlertSeverity.INFO,
        data: asset,
      };
      if (asset.severity === 'expired') {
        critical.push(alert);
        warrantyExpired++;
      } else if (asset.severity === 'warning') {
        warning.push(alert);
        warrantyExpiringSoon++;
      } else {
        info.push(alert);
        warrantyExpiringSoon++;
      }
    }

    return {
      critical,
      warning,
      info,
      counts: {
        cardExpiry: { expired: cardExpired, expiringSoon: cardExpiringSoon },
        vehicleDocExpiry: { expired: vehicleDocExpired, expiringSoon: vehicleDocExpiringSoon },
        vehicleServiceDue: { overdue: serviceOverdue, dueSoon: serviceDueSoon },
        assetCalibration: { overdue: calibrationOverdue, dueSoon: calibrationDueSoon },
        assetWarranty: { expired: warrantyExpired, expiringSoon: warrantyExpiringSoon },
        total: { critical: critical.length, warning: warning.length, info: info.length },
      },
    };
  }

  private async getApprovals(): Promise<ApprovalsData> {
    const [leaveApprovals, attendanceApprovals, expenseApprovals] = await Promise.all([
      this.executeQuery(queries.getPendingLeaveApprovalsQuery(20)),
      this.executeQuery(queries.getPendingAttendanceApprovalsQuery(20)),
      this.executeQuery(queries.getPendingExpenseApprovalsQuery(20)),
    ]);

    const calculateAging = (items: any[]) => ({
      days1: items.filter((i) => i.aging <= 1).length,
      days2_3: items.filter((i) => i.aging >= 2 && i.aging <= 3).length,
      days4Plus: items.filter((i) => i.aging >= 4).length,
    });

    return {
      leave: {
        count: leaveApprovals.length,
        items: leaveApprovals,
        aging: calculateAging(leaveApprovals),
      },
      attendance: {
        count: attendanceApprovals.length,
        items: attendanceApprovals,
        aging: calculateAging(attendanceApprovals),
      },
      expense: {
        count: expenseApprovals.length,
        items: expenseApprovals,
        aging: calculateAging(expenseApprovals),
      },
      totals: {
        leave: leaveApprovals.length,
        attendance: attendanceApprovals.length,
        expense: expenseApprovals.length,
        total: leaveApprovals.length + attendanceApprovals.length + expenseApprovals.length,
      },
    };
  }

  private async getEmployees(): Promise<EmployeesData> {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);

    const [summary, newJoiners, exiting, probation] = await Promise.all([
      this.executeQuery(queries.getEmployeeSummaryQuery()),
      this.executeQuery(
        queries.getNewJoinersQuery(this.formatDate(monthStart), this.formatDate(monthEnd)),
      ),
      this.executeQuery(
        queries.getExitingEmployeesQuery(this.formatDate(today), this.formatDate(nextMonthEnd)),
      ),
      this.executeQuery(queries.getProbationEmployeesQuery()),
    ]);

    const summaryData = summary[0] || {};

    return {
      summary: {
        total: summaryData.total || 0,
        active: summaryData.active || 0,
        inactive: summaryData.inactive || 0,
        onProbation: summaryData.onProbation || 0,
      },
      newJoiners: {
        count: newJoiners.length,
        items: newJoiners,
      },
      exiting: {
        count: exiting.length,
        items: exiting,
      },
      onProbation: {
        count: probation.length,
        items: probation,
      },
      roleDistribution: { labels: [], values: [] }, // TODO: Implement
      departmentDistribution: { labels: [], values: [] }, // TODO: Implement
    };
  }

  private async getTeam(): Promise<TeamData> {
    // TODO: Implement team-specific queries based on manager's team members
    return {
      overview: {
        totalMembers: 0,
        todayPresent: 0,
        todayAbsent: 0,
        todayOnLeave: 0,
      },
      pendingApprovals: {
        leave: 0,
        attendance: 0,
        total: 0,
      },
      members: [],
      upcomingLeaves: [],
      leaveConflicts: [],
      attendanceTrend: { labels: [], datasets: [] },
    };
  }

  private async executeQuery(queryDef: { query: string; params: any[] }): Promise<any[]> {
    try {
      return await this.dataSource.query(queryDef.query, queryDef.params);
    } catch (error) {
      this.logger.error(`Query execution failed: ${error.message}`, error.stack);
      return [];
    }
  }
}
