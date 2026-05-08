import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { GetDashboardDto } from './dto/dashboard.dto';
import {
  DashboardPeriod,
  DASHBOARD_CONSTANTS,
  DASHBOARD_ERRORS,
  AlertType,
  AlertSeverity,
} from './constants/dashboard.constants';
import {
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
  MobileDashboardResponse,
  MobileLeaveBalance,
  MobileFestivalBanner,
  MobileHoliday,
  MobileAnnouncement,
  MobileBirthdayUser,
  MobileAnniversaryUser,
} from './dashboard.types';
import * as queries from './queries/dashboard.queries';
import * as mobileQueries from './queries/mobile-dashboard.queries';
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

  // ==================== Mobile Dashboard ====================

  async getMobileDashboard(userId: string): Promise<MobileDashboardResponse> {
    const todayStr = this.dateTimeService.getTodayString();
    const today = this.dateTimeService.toDate(todayStr);
    const financialYear = this.utilityService.getFinancialYear(today);

    // Fetch all 7 sections in parallel
    const [leaveBalances, holidayResult, announcements, birthdays, anniversaries, emergencyResult] =
      await Promise.all([
        this.getMobileLeaveBalances(userId, financialYear),
        this.getMobileHolidays(financialYear),
        this.getMobileAnnouncements(userId),
        this.getMobileBirthdays(todayStr),
        this.getMobileAnniversaries(todayStr),
        this.getMobileEmergencyContacts(),
      ]);

    // Extract festival banner (next upcoming holiday) from the holidays list
    const festivalBanner = this.getNextUpcomingFestival(holidayResult, today);

    return {
      leaveBalances,
      festivalBanner,
      holidays: holidayResult,
      announcements,
      todayBirthdays: birthdays,
      todayAnniversaries: anniversaries,
      emergencyContacts: emergencyResult,
    };
  }

  private async getMobileLeaveBalances(
    userId: string,
    financialYear: string,
  ): Promise<MobileLeaveBalance[]> {
    const { query, params } = mobileQueries.getMobileLeaveBalancesQuery(userId, financialYear);
    const results = await this.dataSource.query(query, params);

    return results.map((row: any) => ({
      leaveCategory: row.leaveCategory,
      totalAllocated: Number(row.totalAllocated) || 0,
      consumed: Number(row.consumed) || 0,
      carriedForward: Number(row.carriedForward) || 0,
      adjusted: Number(row.adjusted) || 0,
      balance: Number(row.balance) || 0,
    }));
  }

  private async getMobileHolidays(financialYear: string): Promise<MobileHoliday[]> {
    const { query, params } = mobileQueries.getAllHolidaysQuery(financialYear);
    const result = await this.dataSource.query(query, params);

    if (!result[0]?.holidays) return [];

    const holidays = result[0].holidays;

    // holidays can be an array of objects or the value itself containing a holidays key
    const holidayList: Array<{
      date: string;
      title?: string;
      name?: string;
      type?: string;
      icon?: string | null;
      isOptional?: boolean;
    }> = Array.isArray(holidays) ? holidays : holidays?.holidays || [];

    return holidayList
      .map((h) => ({
        date: h.date,
        name: h.title ?? h.name ?? '',
        type: h.type,
        icon: h.icon ?? null,
        isOptional: h.isOptional ?? false,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  private getNextUpcomingFestival(
    holidays: MobileHoliday[],
    today: Date,
  ): MobileFestivalBanner | null {
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    for (const holiday of holidays) {
      const holidayDate = new Date(holiday.date);
      if (holidayDate >= todayStart) {
        const daysUntil = Math.ceil(
          (holidayDate.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24),
        );
        return {
          date: holiday.date,
          name: holiday.name,
          type: holiday.type,
          icon: holiday.icon ?? null,
          isOptional: holiday.isOptional ?? false,
          daysUntil,
        };
      }
    }

    return null;
  }

  private async getMobileAnnouncements(userId: string): Promise<MobileAnnouncement[]> {
    const { query, params } = mobileQueries.getLatestAnnouncementsQuery(userId, 4);
    const results = await this.dataSource.query(query, params);

    return results.map((row: any) => ({
      id: row.id,
      title: row.title,
      message: row.message,
      publishedAt: row.publishedAt || row.createdAt,
    }));
  }

  private async getMobileBirthdays(todayStr: string): Promise<MobileBirthdayUser[]> {
    const { query, params } = mobileQueries.getTodayBirthdaysQuery(todayStr);
    const results = await this.dataSource.query(query, params);

    return results.map((row: any) => ({
      userId: row.userId,
      name: row.name,
      employeeId: row.employeeId,
      profilePicture: row.profilePicture,
      date: row.date,
    }));
  }

  private async getMobileAnniversaries(todayStr: string): Promise<MobileAnniversaryUser[]> {
    const { query, params } = mobileQueries.getTodayAnniversariesQuery(todayStr);
    const results = await this.dataSource.query(query, params);

    return results.map((row: any) => ({
      userId: row.userId,
      name: row.name,
      employeeId: row.employeeId,
      profilePicture: row.profilePicture,
      date: row.date,
      yearsCompleted: Number(row.yearsCompleted) || 0,
    }));
  }

  private async getMobileEmergencyContacts(): Promise<any> {
    const { query, params } = mobileQueries.getEmergencyContactsQuery();
    const result = await this.dataSource.query(query, params);
    return result[0]?.contacts || null;
  }

  // ==================== Web Dashboard Helpers ====================

  getDateRange(query: GetDashboardDto): { startDate: string; endDate: string } {
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

  isAdminRole(userRole: string): boolean {
    return [Roles.SUPER_ADMIN, Roles.ADMIN, Roles.HR, Roles.MANAGER].includes(userRole as Roles);
  }

  // ==================== Section Implementations ====================

  async getOverview(): Promise<OverviewData> {
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

  async getBirthdays(): Promise<BirthdayData> {
    const todayStr = this.dateTimeService.getTodayString();
    const today = this.dateTimeService.toDate(todayStr);
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + 7);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const { query, params } = queries.getBirthdaysQuery(
      todayStr,
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

  async getAnniversaries(): Promise<AnniversaryData> {
    const todayStr = this.dateTimeService.getTodayString();
    const today = this.dateTimeService.toDate(todayStr);
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + 7);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const { query, params } = queries.getAnniversariesQuery(
      todayStr,
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

  async getFestivals(): Promise<FestivalData> {
    const today = new Date();
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const { query, params } = queries.getHolidaysQuery();

    const result = await this.dataSource.query(query, params);

    const todayList: Holiday[] = [];
    const upcomingList: Holiday[] = [];
    const monthList: Holiday[] = [];

    if (result[0]?.holidays) {
      const rawValue = result[0].holidays;
      const holidays = (Array.isArray(rawValue) ? rawValue : rawValue?.holidays || []) as Array<{
        date: string;
        title?: string;
        name?: string;
        type?: string;
      }>;

      const todayStr = this.dateTimeService.getTodayString();

      for (const holiday of holidays) {
        const holidayDate = new Date(holiday.date);
        const holidayStr = this.formatDate(holidayDate);

        if (holidayStr < todayStr) continue;

        const daysUntil = Math.ceil(
          (holidayDate.getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24),
        );

        const item: Holiday = {
          date: holiday.date,
          name: holiday.title ?? holiday.name ?? '',
          type: holiday.type,
          daysUntil,
        };

        if (holidayStr === todayStr) {
          todayList.push(item);
        }

        if (daysUntil <= 14) {
          upcomingList.push(item);
        }

        if (holidayStr <= this.formatDate(monthEnd)) {
          monthList.push(item);
        }
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

  async getAttendance(): Promise<AttendanceData> {
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

  async getLeave(dateRange: { startDate: string; endDate: string }): Promise<LeaveData> {
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

  async getPayroll(): Promise<PayrollData> {
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

  async getExpenses(dateRange: { startDate: string; endDate: string }): Promise<ExpenseData> {
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

  async getAlerts(): Promise<AlertsData> {
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

    // Lost assets count (status = LOST on active version)
    const lostCountRow = await this.dataSource.query(
      `SELECT COUNT(*)::int as count
       FROM asset_versions av
       INNER JOIN asset_masters am ON am.id = av."assetMasterId"
       WHERE av."isActive" = true
         AND av."deletedAt" IS NULL
         AND am."deletedAt" IS NULL
         AND av.status = 'LOST'`,
    );
    const lostAssetsTotal = Number(lostCountRow[0]?.count) || 0;

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
        lostAssets: { total: lostAssetsTotal },
        total: { critical: critical.length, warning: warning.length, info: info.length },
      },
    };
  }

  async getApprovals(): Promise<ApprovalsData> {
    const [leaveApprovals, attendanceApprovals, expenseApprovals, fuelExpenseApprovals] =
      await Promise.all([
        this.executeQuery(queries.getPendingLeaveApprovalsQuery(20)),
        this.executeQuery(queries.getPendingAttendanceApprovalsQuery(20)),
        this.executeQuery(queries.getPendingExpenseApprovalsQuery(20)),
        this.executeQuery(queries.getPendingFuelExpenseApprovalsQuery(20)),
      ]);

    //TODO: temporary for now
    const siteDocumentsApprovals = [];

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
      fuelExpense: {
        count: fuelExpenseApprovals.length,
        items: fuelExpenseApprovals,
        aging: calculateAging(fuelExpenseApprovals),
      },
      siteDocuments: {
        count: siteDocumentsApprovals.length,
        items: siteDocumentsApprovals,
        aging: calculateAging(siteDocumentsApprovals),
      },
      totals: {
        leave: leaveApprovals.length,
        attendance: attendanceApprovals.length,
        expense: expenseApprovals.length,
        fuelExpense: fuelExpenseApprovals.length,
        siteDocuments: siteDocumentsApprovals.length,
        total:
          leaveApprovals.length +
          attendanceApprovals.length +
          expenseApprovals.length +
          fuelExpenseApprovals.length +
          siteDocumentsApprovals.length,
      },
    };
  }

  async getEmployees(): Promise<EmployeesData> {
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

  async getTeam(): Promise<TeamData> {
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

  // ==================== NEW: Vehicle Readings ====================

  async getVehicleReadings(): Promise<{
    anomalies: {
      count: number;
      items: Array<{
        vehicleId: string;
        registrationNo: string;
        brand: string;
        model: string;
        reason: string;
        reportedAt: string;
      }>;
    };
    noReading2Days: {
      count: number;
      items: Array<{
        vehicleId: string;
        registrationNo: string;
        brand: string;
        model: string;
        lastReadingDate: string | null;
      }>;
    };
  }> {
    // Anomalies: vehicle_logs where odometer dropped or unreasonable jump
    const anomalies = await this.dataSource.query(`
      WITH active_versions AS (
        SELECT DISTINCT ON (vm.id) vm.id as "vehicleMasterId", vm."registrationNo", vv.brand, vv.model
        FROM vehicle_masters vm
        JOIN vehicle_versions vv ON vv."vehicleMasterId" = vm.id
        WHERE vm."deletedAt" IS NULL AND vv."deletedAt" IS NULL AND vv."isActive" = true
        ORDER BY vm.id, vv."createdAt" DESC
      ),
      log_pairs AS (
        SELECT
          vl."vehicleId",
          vl."endOdometerReading"::numeric as current_odo,
          vl."createdAt",
          LAG(vl."endOdometerReading"::numeric) OVER (PARTITION BY vl."vehicleId" ORDER BY vl."createdAt") as prev_odo,
          LAG(vl."createdAt") OVER (PARTITION BY vl."vehicleId" ORDER BY vl."createdAt") as prev_time
        FROM vehicle_logs vl
        WHERE vl."deletedAt" IS NULL AND vl."endOdometerReading" IS NOT NULL
      )
      SELECT av."vehicleMasterId" as "vehicleId", av."registrationNo", av.brand, av.model,
        CASE
          WHEN lp.current_odo < lp.prev_odo THEN 'Odometer rollback: ' || lp.current_odo || ' < previous ' || lp.prev_odo
          ELSE 'Unusual jump: ' || (lp.current_odo - lp.prev_odo) || ' km in short interval'
        END as reason,
        lp."createdAt"::text as "reportedAt"
      FROM log_pairs lp
      JOIN active_versions av ON av."vehicleMasterId" = lp."vehicleId"
      WHERE lp.current_odo < lp.prev_odo
         OR (lp.current_odo - lp.prev_odo > 1000 AND EXTRACT(EPOCH FROM (lp."createdAt" - lp.prev_time))/3600 < 12)
      ORDER BY lp."createdAt" DESC
      LIMIT 20
    `);

    // No reading in last 2+ days
    const noReading = await this.dataSource.query(`
      WITH active_versions AS (
        SELECT DISTINCT ON (vm.id) vm.id as "vehicleMasterId", vm."registrationNo", vv.brand, vv.model
        FROM vehicle_masters vm
        JOIN vehicle_versions vv ON vv."vehicleMasterId" = vm.id
        WHERE vm."deletedAt" IS NULL AND vv."deletedAt" IS NULL
          AND vv."isActive" = true AND vv."status" != 'RETIRED'
        ORDER BY vm.id, vv."createdAt" DESC
      ),
      last_readings AS (
        SELECT "vehicleId", MAX("createdAt") as last_reading
        FROM vehicle_logs WHERE "deletedAt" IS NULL
        GROUP BY "vehicleId"
      )
      SELECT av."vehicleMasterId" as "vehicleId", av."registrationNo", av.brand, av.model,
        lr.last_reading::text as "lastReadingDate"
      FROM active_versions av
      LEFT JOIN last_readings lr ON lr."vehicleId" = av."vehicleMasterId"
      WHERE lr.last_reading IS NULL
         OR lr.last_reading < NOW() - INTERVAL '2 days'
      ORDER BY lr.last_reading ASC NULLS FIRST
      LIMIT 20
    `);

    return {
      anomalies: { count: anomalies.length, items: anomalies },
      noReading2Days: { count: noReading.length, items: noReading },
    };
  }

  // ==================== NEW: Asset Summary ====================

  async getAssetSummary(): Promise<{
    total: number;
    available: number;
    assigned: number;
    lost: number;
    retired: number;
    underMaintenance: number;
  }> {
    const rows = await this.dataSource.query(`
      SELECT av.status, COUNT(*)::int as count
      FROM asset_masters am
      JOIN asset_versions av ON av."assetMasterId" = am.id AND av."isActive" = true
      WHERE am."deletedAt" IS NULL AND av."deletedAt" IS NULL
      GROUP BY av.status
    `);
    const map: Record<string, number> = {};
    for (const r of rows) map[r.status] = Number(r.count);
    const total = Object.values(map).reduce((s: number, v: number) => s + v, 0);
    return {
      total,
      available: map['AVAILABLE'] || 0,
      assigned: map['ASSIGNED'] || 0,
      lost: map['LOST'] || 0,
      retired: map['RETIRED'] || 0,
      underMaintenance: map['UNDER_MAINTENANCE'] || 0,
    };
  }

  // ==================== NEW: Vehicle Summary ====================

  async getVehicleSummary(): Promise<{
    total: number;
    available: number;
    assigned: number;
    retired: number;
  }> {
    const rows = await this.dataSource.query(`
      SELECT vv.status, COUNT(*)::int as count
      FROM vehicle_masters vm
      JOIN vehicle_versions vv ON vv."vehicleMasterId" = vm.id AND vv."isActive" = true
      WHERE vm."deletedAt" IS NULL AND vv."deletedAt" IS NULL
      GROUP BY vv.status
    `);
    const map: Record<string, number> = {};
    for (const r of rows) map[r.status] = Number(r.count);
    const total = Object.values(map).reduce((s: number, v: number) => s + v, 0);
    return {
      total,
      available: map['AVAILABLE'] || 0,
      assigned: map['ASSIGNED'] || 0,
      retired: map['RETIRED'] || 0,
    };
  }

  // ==================== NEW: Projects Pipeline ====================

  async getProjectsPipeline(): Promise<{
    counts: { active: number; upcoming: number; onHold: number; completed: number; total: number };
    activeContractTotal: number;
    activeSpendToDate: number;
    activeNetPL: number;
    activeProjects: Array<{
      id: string;
      name: string;
      projectCode: string | null;
      contractAmount: number;
      spendToDate: number;
      netPL: number;
      progressPercent: number;
    }>;
  }> {
    const counts = await this.dataSource.query(`
      SELECT
        COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END)::int as active,
        COUNT(CASE WHEN status = 'UPCOMING' THEN 1 END)::int as upcoming,
        COUNT(CASE WHEN status = 'ON_HOLD' THEN 1 END)::int as "onHold",
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END)::int as completed,
        COUNT(*)::int as total
      FROM sites WHERE "deletedAt" IS NULL
    `);

    const [totals, projects] = await Promise.all([
      this.dataSource.query(`
        WITH expense_totals AS (
          SELECT s.id as "siteId", COALESCE(SUM(e.amount::numeric), 0) as spend
          FROM sites s
          LEFT JOIN expenses e ON e."siteId" = s.id
            AND e."deletedAt" IS NULL AND e."isActive" = true
            AND e."approvalStatus" = 'approved'
          WHERE s."deletedAt" IS NULL AND s.status = 'ACTIVE'
          GROUP BY s.id
        )
        SELECT
          COALESCE(SUM(s."estimatedBudget"::numeric), 0) as "contractTotal",
          COALESCE(SUM(et.spend), 0) as "spendToDate",
          COALESCE(SUM(COALESCE(s."estimatedBudget"::numeric, 0) - COALESCE(et.spend, 0)), 0) as "netPL"
        FROM sites s
        LEFT JOIN expense_totals et ON et."siteId" = s.id
        WHERE s."deletedAt" IS NULL AND s.status = 'ACTIVE'
      `),
      this.dataSource.query(`
        WITH expense_totals AS (
          SELECT s.id as "siteId", COALESCE(SUM(e.amount::numeric), 0) as spend
          FROM sites s
          LEFT JOIN expenses e ON e."siteId" = s.id
            AND e."deletedAt" IS NULL AND e."isActive" = true
            AND e."approvalStatus" = 'approved'
          WHERE s."deletedAt" IS NULL AND s.status = 'ACTIVE'
          GROUP BY s.id
        )
        SELECT
          s.id,
          s.name,
          s."projectCode",
          COALESCE(s."estimatedBudget"::numeric, 0) as "contractAmount",
          COALESCE(et.spend, 0) as "spendToDate",
          COALESCE(s."estimatedBudget"::numeric, 0) - COALESCE(et.spend, 0) as "netPL",
          CASE
            WHEN COALESCE(s."estimatedBudget"::numeric, 0) = 0 THEN 0
            ELSE ROUND((COALESCE(et.spend, 0) / s."estimatedBudget"::numeric) * 100)
          END as "progressPercent"
        FROM sites s
        LEFT JOIN expense_totals et ON et."siteId" = s.id
        WHERE s."deletedAt" IS NULL AND s.status = 'ACTIVE'
        ORDER BY s."createdAt" DESC
      `),
    ]);

    return {
      counts: counts[0] || { active: 0, upcoming: 0, onHold: 0, completed: 0, total: 0 },
      activeContractTotal: Number(totals[0]?.contractTotal) || 0,
      activeSpendToDate: Number(totals[0]?.spendToDate) || 0,
      activeNetPL: Number(totals[0]?.netPL) || 0,
      activeProjects: projects.map((p: any) => ({
        id: p.id,
        name: p.name,
        projectCode: p.projectCode || null,
        contractAmount: Number(p.contractAmount),
        spendToDate: Number(p.spendToDate),
        netPL: Number(p.netPL),
        progressPercent: Number(p.progressPercent),
      })),
    };
  }

  // ==================== NEW: Ledger Balances ====================

  async getLedgerBalances() {
    const today = new Date();
    const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;

    // debit = company owes employee (+), credit = company paid employee (-)
    const EXP_NET = `CASE WHEN e."transactionType" = 'debit' THEN e.amount::numeric ELSE -e.amount::numeric END`;
    const FUEL_NET = `CASE WHEN fe."transactionType" = 'debit' THEN fe."fuelAmount"::numeric ELSE -fe."fuelAmount"::numeric END`;

    const [expApprovals, expBalances, expByUser, fuelApprovals, fuelBalances, fuelByUser] =
      await Promise.all([
        // Expense approval counts
        this.dataSource.query(`
          SELECT
            COUNT(CASE WHEN "approvalStatus" = 'pending'  THEN 1 END)::int AS pending,
            COUNT(CASE WHEN "approvalStatus" = 'approved' THEN 1 END)::int AS approved,
            COUNT(CASE WHEN "approvalStatus" = 'rejected' THEN 1 END)::int AS rejected,
            COUNT(*)::int AS total
          FROM expenses WHERE "deletedAt" IS NULL AND "isActive" = true
        `),

        // Expense balances (approved only)
        this.dataSource.query(
          `
          SELECT
            COALESCE(SUM(CASE WHEN "expenseDate" < $1
              THEN CASE WHEN "transactionType" = 'debit' THEN amount::numeric ELSE -amount::numeric END
            END), 0) AS opening,
            COALESCE(SUM(
              CASE WHEN "transactionType" = 'debit' THEN amount::numeric ELSE -amount::numeric END
            ), 0) AS closing
          FROM expenses
          WHERE "deletedAt" IS NULL AND "isActive" = true AND "approvalStatus" = 'approved'
        `,
          [monthStart],
        ),

        // Expense employee-wise net (approved only)
        this.dataSource.query(`
          SELECT
            u.id AS "userId", u."firstName", u."lastName", u."employeeId",
            COALESCE(SUM(${EXP_NET}), 0) AS net
          FROM users u
          LEFT JOIN expenses e ON e."userId" = u.id
            AND e."deletedAt" IS NULL AND e."isActive" = true AND e."approvalStatus" = 'approved'
          WHERE u."deletedAt" IS NULL AND u.status = 'ACTIVE'
          GROUP BY u.id, u."firstName", u."lastName", u."employeeId"
          HAVING COALESCE(SUM(${EXP_NET}), 0) != 0
          ORDER BY ABS(COALESCE(SUM(${EXP_NET}), 0)) DESC
          LIMIT 50
        `),

        // Fuel approval counts
        this.dataSource.query(`
          SELECT
            COUNT(CASE WHEN "approvalStatus" = 'pending'  THEN 1 END)::int AS pending,
            COUNT(CASE WHEN "approvalStatus" = 'approved' THEN 1 END)::int AS approved,
            COUNT(CASE WHEN "approvalStatus" = 'rejected' THEN 1 END)::int AS rejected,
            COUNT(*)::int AS total
          FROM fuel_expenses WHERE "deletedAt" IS NULL AND "isActive" = true
        `),

        // Fuel balances (approved only)
        this.dataSource.query(
          `
          SELECT
            COALESCE(SUM(CASE WHEN "fillDate" < $1
              THEN CASE WHEN "transactionType" = 'debit' THEN "fuelAmount"::numeric ELSE -"fuelAmount"::numeric END
            END), 0) AS opening,
            COALESCE(SUM(
              CASE WHEN "transactionType" = 'debit' THEN "fuelAmount"::numeric ELSE -"fuelAmount"::numeric END
            ), 0) AS closing
          FROM fuel_expenses
          WHERE "deletedAt" IS NULL AND "isActive" = true AND "approvalStatus" = 'approved'
        `,
          [monthStart],
        ),

        // Fuel employee-wise net (approved only)
        this.dataSource.query(`
          SELECT
            u.id AS "userId", u."firstName", u."lastName", u."employeeId",
            COALESCE(SUM(${FUEL_NET}), 0) AS net
          FROM users u
          LEFT JOIN fuel_expenses fe ON fe."userId" = u.id
            AND fe."deletedAt" IS NULL AND fe."isActive" = true AND fe."approvalStatus" = 'approved'
          WHERE u."deletedAt" IS NULL AND u.status = 'ACTIVE'
          GROUP BY u.id, u."firstName", u."lastName", u."employeeId"
          HAVING COALESCE(SUM(${FUEL_NET}), 0) != 0
          ORDER BY ABS(COALESCE(SUM(${FUEL_NET}), 0)) DESC
          LIMIT 50
        `),
      ]);

    // net > 0 = company owes employee (PAYABLE)
    // net < 0 = company paid more than owed (OVERPAID)
    const mapStatus = (net: number): 'payable' | 'overpaid' | 'settled' => {
      if (net > 0) return 'payable';
      if (net < 0) return 'overpaid';
      return 'settled';
    };

    const buildSummary = (rows: any[]) => {
      const mapped = rows.map((u: any) => ({
        userId: u.userId,
        firstName: u.firstName,
        lastName: u.lastName,
        employeeId: u.employeeId,
        net: Number(u.net),
        status: mapStatus(Number(u.net)),
      }));
      return {
        payable: {
          count: mapped.filter((u) => u.status === 'payable').length,
          totalAmount: mapped.filter((u) => u.status === 'payable').reduce((s, u) => s + u.net, 0),
          employees: mapped.filter((u) => u.status === 'payable'),
        },
        overpaid: {
          count: mapped.filter((u) => u.status === 'overpaid').length,
          totalAmount: mapped
            .filter((u) => u.status === 'overpaid')
            .reduce((s, u) => s + Math.abs(u.net), 0),
          employees: mapped.filter((u) => u.status === 'overpaid'),
        },
      };
    };

    return {
      expense: {
        approvals: expApprovals[0] || { pending: 0, approved: 0, rejected: 0, total: 0 },
        balances: {
          opening: Number(expBalances[0]?.opening) || 0,
          closing: Number(expBalances[0]?.closing) || 0,
        },
        ...buildSummary(expByUser),
      },
      fuel: {
        approvals: fuelApprovals[0] || { pending: 0, approved: 0, rejected: 0, total: 0 },
        balances: {
          opening: Number(fuelBalances[0]?.opening) || 0,
          closing: Number(fuelBalances[0]?.closing) || 0,
        },
        ...buildSummary(fuelByUser),
      },
    };
  }

  // ==================== NEW: Cron Health ====================

  async getCronHealth(): Promise<{
    summary: { total: number; success: number; failed: number; running: number };
    items: Array<{
      cronName: string;
      lastRunAt: string | null;
      status: string | null;
      durationMs: number | null;
      errorMessage: string | null;
    }>;
  }> {
    // Get latest log per cron job name
    const items = await this.dataSource.query(`
      SELECT DISTINCT ON ("jobName") "jobName" as "cronName",
        "startedAt"::text as "lastRunAt",
        status,
        "durationMs",
        "errorMessage"
      FROM cron_logs
      ORDER BY "jobName", "startedAt" DESC
    `);

    const summary = items.reduce(
      (acc: any, row: any) => {
        acc.total++;
        if (row.status === 'SUCCESS') acc.success++;
        else if (row.status === 'FAILED') acc.failed++;
        else if (row.status === 'RUNNING') acc.running++;
        return acc;
      },
      { total: 0, success: 0, failed: 0, running: 0 },
    );

    return {
      summary,
      items: items.map((r: any) => ({
        cronName: r.cronName,
        lastRunAt: r.lastRunAt,
        status: r.status,
        durationMs: r.durationMs ? Number(r.durationMs) : null,
        errorMessage: r.errorMessage,
      })),
    };
  }

  // ==================== NEW: Leave Exhaustion ====================

  async getLeaveExhaustion(): Promise<{
    threshold: number;
    count: number;
    items: Array<{
      userId: string;
      firstName: string;
      lastName: string;
      employeeId: string;
      leaveCategory: string;
      remaining: number;
      totalAllocated: number;
      consumed: number;
    }>;
  }> {
    const today = new Date();
    const fyMonth = today.getMonth() >= 3 ? today.getMonth() - 2 : today.getMonth() + 10;
    const fyStartYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
    const financialYear = `${fyStartYear}-${fyStartYear + 1}`;

    const THRESHOLD = 2;

    const items = await this.dataSource.query(
      `
      SELECT u.id as "userId", u."firstName", u."lastName", u."employeeId",
        lb."leaveCategory",
        lb."totalAllocated"::numeric as "totalAllocated",
        lb.consumed::numeric as consumed,
        (lb."totalAllocated"::numeric + lb."carriedForward"::numeric + lb.adjusted::numeric - lb.consumed::numeric) as remaining
      FROM leave_balances lb
      JOIN users u ON u.id = lb."userId"
      WHERE lb."deletedAt" IS NULL
        AND lb."financialYear" = $1
        AND u."deletedAt" IS NULL AND u.status = 'ACTIVE'
        AND (lb."totalAllocated"::numeric + lb."carriedForward"::numeric + lb.adjusted::numeric - lb.consumed::numeric) <= $2
      ORDER BY remaining ASC, u."firstName"
      `,
      [financialYear, THRESHOLD],
    );

    return {
      threshold: THRESHOLD,
      count: items.length,
      items: items.map((r: any) => ({
        userId: r.userId,
        firstName: r.firstName,
        lastName: r.lastName,
        employeeId: r.employeeId,
        leaveCategory: r.leaveCategory,
        remaining: Number(r.remaining),
        totalAllocated: Number(r.totalAllocated),
        consumed: Number(r.consumed),
      })),
    };
    void fyMonth;
  }

  // ==================== NEW: Payroll Status ====================

  async getPayrollStatus(): Promise<{
    currentMonth: { month: number; year: number; label: string };
    counts: {
      generated: number;
      pending: number;
      paid: number;
      total: number;
      activeEmployees: number;
    };
    lastGeneratedAt: string | null;
  }> {
    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();

    const counts = await this.dataSource.query(
      `
      SELECT
        COUNT(*)::int as generated,
        COUNT(CASE WHEN status = 'PAID' THEN 1 END)::int as paid,
        COUNT(CASE WHEN status != 'PAID' THEN 1 END)::int as pending,
        MAX("createdAt")::text as "lastGeneratedAt"
      FROM payroll
      WHERE "deletedAt" IS NULL AND month = $1 AND year = $2
      `,
      [month, year],
    );

    const empCount = await this.dataSource.query(
      `SELECT COUNT(*)::int as c FROM users WHERE "deletedAt" IS NULL AND status = 'ACTIVE'`,
    );

    const monthLabel = today.toLocaleString('en-US', { month: 'long' });

    return {
      currentMonth: { month, year, label: `${monthLabel} ${year}` },
      counts: {
        generated: counts[0]?.generated || 0,
        pending: counts[0]?.pending || 0,
        paid: counts[0]?.paid || 0,
        total: empCount[0]?.c || 0,
        activeEmployees: empCount[0]?.c || 0,
      },
      lastGeneratedAt: counts[0]?.lastGeneratedAt || null,
    };
  }

  // ==================== NEW: Financial Dashboard (BRD §10) ====================

  /**
   * Get pending financial approvals across all sites (PO/JMC/Invoice)
   * For the Universal View dashboard
   */
  async getFinancialApprovals(filters?: {
    siteId?: string;
    companyId?: string;
    partyType?: string;
  }): Promise<{
    summary: {
      totalPending: number;
      pendingPOs: number;
      pendingJMCs: number;
      pendingInvoices: number;
    };
    pendingItems: Array<{
      documentType: string;
      id: string;
      documentNumber: string;
      siteId: string;
      siteName: string;
      partyType: string;
      partyName: string;
      totalAmount: number;
      createdAt: string;
      daysPending: number;
    }>;
  }> {
    let whereClause = `WHERE d."approvalStatus" = 'PENDING' AND d."deletedAt" IS NULL`;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.siteId) {
      whereClause += ` AND d."siteId" = $${paramIndex++}`;
      params.push(filters.siteId);
    }

    if (filters?.companyId) {
      whereClause += ` AND s."companyId" = $${paramIndex++}`;
      params.push(filters.companyId);
    }

    if (filters?.partyType) {
      whereClause += ` AND d."partyType" = $${paramIndex++}`;
      params.push(filters.partyType);
    }

    const query = `
      WITH pending_docs AS (
        SELECT 'PO' as "documentType", po.id, po."poNumber" as "documentNumber", 
               po."siteId", po."partyType", po."totalAmount", po."createdAt",
               po."contractorId", po."vendorId"
        FROM purchase_orders po
        JOIN sites s ON s.id = po."siteId"
        ${whereClause.replace(/d\./g, 'po.')}
        
        UNION ALL
        
        SELECT 'JMC' as "documentType", j.id, j."jmcNumber" as "documentNumber",
               j."siteId", j."partyType",
               -- JMCs carry no financial amount; 0 used for UI display consistency
               0::decimal as "totalAmount",
               j."createdAt",
               j."contractorId", j."vendorId"
        FROM jmcs j
        JOIN sites s ON s.id = j."siteId"
        ${whereClause.replace(/d\./g, 'j.')}
        
        UNION ALL
        
        SELECT 'INVOICE' as "documentType", i.id, i."invoiceNumber" as "documentNumber",
               i."siteId", i."partyType", i."totalAmount", i."createdAt",
               i."contractorId", i."vendorId"
        FROM site_invoices i
        JOIN sites s ON s.id = i."siteId"
        ${whereClause.replace(/d\./g, 'i.')}
      )
      SELECT 
        pd."documentType",
        pd.id,
        pd."documentNumber",
        pd."siteId",
        s.name as "siteName",
        pd."partyType",
        COALESCE(c.name, v.name) as "partyName",
        pd."totalAmount"::numeric,
        pd."createdAt"::text,
        EXTRACT(DAY FROM NOW() - pd."createdAt")::int as "daysPending"
      FROM pending_docs pd
      JOIN sites s ON s.id = pd."siteId"
      LEFT JOIN contractors c ON c.id = pd."contractorId"
      LEFT JOIN vendors v ON v.id = pd."vendorId"
      ORDER BY pd."createdAt" ASC
      LIMIT 100
    `;

    // The UNION ALL query shares a single global parameter namespace in
    // Postgres — $1 in the PO subquery and $1 in the JMC/Invoice subquery
    // all refer to params[0]. Pass params once; spreading 3× causes the
    // "bind message supplies N params but prepared statement requires 1" error.
    const items = await this.dataSource.query(query, params);

    // Get summary counts
    const summaryQuery = `
      SELECT 
        (SELECT COUNT(*) FROM purchase_orders WHERE "approvalStatus" = 'PENDING' AND "deletedAt" IS NULL)::int as "pendingPOs",
        (SELECT COUNT(*) FROM jmcs WHERE "approvalStatus" = 'PENDING' AND "deletedAt" IS NULL)::int as "pendingJMCs",
        (SELECT COUNT(*) FROM site_invoices WHERE "approvalStatus" = 'PENDING' AND "deletedAt" IS NULL)::int as "pendingInvoices"
    `;

    const summary = await this.dataSource.query(summaryQuery);

    return {
      summary: {
        totalPending:
          (summary[0]?.pendingPOs || 0) +
          (summary[0]?.pendingJMCs || 0) +
          (summary[0]?.pendingInvoices || 0),
        pendingPOs: summary[0]?.pendingPOs || 0,
        pendingJMCs: summary[0]?.pendingJMCs || 0,
        pendingInvoices: summary[0]?.pendingInvoices || 0,
      },
      pendingItems: items.map((item: any) => ({
        documentType: item.documentType,
        id: item.id,
        documentNumber: item.documentNumber,
        siteId: item.siteId,
        siteName: item.siteName,
        partyType: item.partyType,
        partyName: item.partyName,
        totalAmount: Number(item.totalAmount),
        createdAt: item.createdAt,
        daysPending: item.daysPending,
      })),
    };
  }

  /**
   * Get cross-site financial summary (PO totals, invoiced, paid, etc.)
   * For the Universal View dashboard (BRD §10)
   */
  async getFinancialSummary(filters?: {
    siteId?: string;
    companyId?: string;
    partyType?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<{
    totals: {
      totalPOValue: number;
      invoicedTotal: number;
      bookedTotal: number;
      paidTotal: number;
      uninvoiced: number;
      pendingPayment: number;
    };
    bySite: Array<{
      siteId: string;
      siteName: string;
      companyId: string;
      companyName: string;
      poCount: number;
      totalPOValue: number;
      invoicedTotal: number;
      bookedTotal: number;
      paidTotal: number;
      uninvoiced: number;
    }>;
    byPartyType: {
      SALE: { poCount: number; totalValue: number; invoiced: number; paid: number };
      PURCHASE: { poCount: number; totalValue: number; invoiced: number; paid: number };
    };
  }> {
    let whereClause = `WHERE po."deletedAt" IS NULL AND po."approvalStatus" = 'APPROVED'`;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.siteId) {
      whereClause += ` AND po."siteId" = $${paramIndex++}`;
      params.push(filters.siteId);
    }

    if (filters?.companyId) {
      whereClause += ` AND s."companyId" = $${paramIndex++}`;
      params.push(filters.companyId);
    }

    if (filters?.partyType) {
      whereClause += ` AND po."partyType" = $${paramIndex++}`;
      params.push(filters.partyType);
    }

    if (filters?.fromDate) {
      whereClause += ` AND po."poDate" >= $${paramIndex++}`;
      params.push(filters.fromDate);
    }

    if (filters?.toDate) {
      whereClause += ` AND po."poDate" <= $${paramIndex++}`;
      params.push(filters.toDate);
    }

    // Get totals
    const totalsQuery = `
      SELECT 
        COALESCE(SUM(po."totalAmount"), 0)::numeric as "totalPOValue",
        COALESCE(SUM(po."invoicedTotal"), 0)::numeric as "invoicedTotal",
        COALESCE(SUM(po."bookedTotal"), 0)::numeric as "bookedTotal",
        COALESCE(SUM(po."paidTotal"), 0)::numeric as "paidTotal",
        COALESCE(SUM(po."totalAmount" - po."invoicedTotal"), 0)::numeric as "uninvoiced",
        COALESCE(SUM(po."invoicedTotal" - po."paidTotal"), 0)::numeric as "pendingPayment"
      FROM purchase_orders po
      JOIN sites s ON s.id = po."siteId"
      ${whereClause}
    `;

    const totals = await this.dataSource.query(totalsQuery, params);

    // Get by site
    const bySiteQuery = `
      SELECT 
        po."siteId",
        s.name as "siteName",
        s."companyId",
        c.name as "companyName",
        COUNT(po.id)::int as "poCount",
        COALESCE(SUM(po."totalAmount"), 0)::numeric as "totalPOValue",
        COALESCE(SUM(po."invoicedTotal"), 0)::numeric as "invoicedTotal",
        COALESCE(SUM(po."bookedTotal"), 0)::numeric as "bookedTotal",
        COALESCE(SUM(po."paidTotal"), 0)::numeric as "paidTotal",
        COALESCE(SUM(po."totalAmount" - po."invoicedTotal"), 0)::numeric as "uninvoiced"
      FROM purchase_orders po
      JOIN sites s ON s.id = po."siteId"
      JOIN companies c ON c.id = s."companyId"
      ${whereClause}
      GROUP BY po."siteId", s.name, s."companyId", c.name
      ORDER BY "totalPOValue" DESC
      LIMIT 50
    `;

    const bySite = await this.dataSource.query(bySiteQuery, params);

    // Get by party type
    const byPartyTypeQuery = `
      SELECT 
        po."partyType",
        COUNT(po.id)::int as "poCount",
        COALESCE(SUM(po."totalAmount"), 0)::numeric as "totalValue",
        COALESCE(SUM(po."invoicedTotal"), 0)::numeric as "invoiced",
        COALESCE(SUM(po."paidTotal"), 0)::numeric as "paid"
      FROM purchase_orders po
      JOIN sites s ON s.id = po."siteId"
      ${whereClause}
      GROUP BY po."partyType"
    `;

    const byPartyType = await this.dataSource.query(byPartyTypeQuery, params);

    const saleStats = byPartyType.find((p: any) => p.partyType === 'SALE') || {};
    const purchaseStats = byPartyType.find((p: any) => p.partyType === 'PURCHASE') || {};

    return {
      totals: {
        totalPOValue: Number(totals[0]?.totalPOValue) || 0,
        invoicedTotal: Number(totals[0]?.invoicedTotal) || 0,
        bookedTotal: Number(totals[0]?.bookedTotal) || 0,
        paidTotal: Number(totals[0]?.paidTotal) || 0,
        uninvoiced: Number(totals[0]?.uninvoiced) || 0,
        pendingPayment: Number(totals[0]?.pendingPayment) || 0,
      },
      bySite: bySite.map((site: any) => ({
        siteId: site.siteId,
        siteName: site.siteName,
        companyId: site.companyId,
        companyName: site.companyName,
        poCount: site.poCount,
        totalPOValue: Number(site.totalPOValue),
        invoicedTotal: Number(site.invoicedTotal),
        bookedTotal: Number(site.bookedTotal),
        paidTotal: Number(site.paidTotal),
        uninvoiced: Number(site.uninvoiced),
      })),
      byPartyType: {
        SALE: {
          poCount: saleStats.poCount || 0,
          totalValue: Number(saleStats.totalValue) || 0,
          invoiced: Number(saleStats.invoiced) || 0,
          paid: Number(saleStats.paid) || 0,
        },
        PURCHASE: {
          poCount: purchaseStats.poCount || 0,
          totalValue: Number(purchaseStats.totalValue) || 0,
          invoiced: Number(purchaseStats.invoiced) || 0,
          paid: Number(purchaseStats.paid) || 0,
        },
      },
    };
  }
}
