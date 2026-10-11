import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { UtilityService } from 'src/utils/utility/utility.service';
import { DateTimeService } from 'src/utils/datetime/datetime.service';
import { Roles } from 'src/modules/roles/constants/role.constants';
import * as q from './queries/my-dashboard.queries';
import {
  MyAlert,
  MyAlertsData,
  MyAssetsData,
  MyAttendanceCounts,
  MyAttendanceData,
  MyExpenseData,
  MyFuelData,
  MyLeaveData,
  MyProjectData,
  MyVehicleData,
  OutgoingHandover,
  PendingHandover,
} from './my-dashboard.types';

/** How many past projects the history list carries. The full list has its own screen. */
const PROJECT_HISTORY_LIMIT = 10;

/** A leave balance at or below this is worth telling someone about. Mirrors the HR alert. */
const LOW_LEAVE_BALANCE_DAYS = 2;

/** Documents and calibration inside this many days are flagged. */
const EXPIRY_WARNING_DAYS = 30;

/**
 * The dashboard an employee or driver sees, as opposed to the one an admin sees.
 *
 * Every method takes the caller's own id and answers only about them. That is the whole access
 * model: there is no `userId` parameter anywhere, so there is nothing to tamper with and no
 * permission to check beyond being logged in. The admin endpoints are untouched and stay behind
 * their role guard.
 *
 * Figures are computed the same way as their admin counterparts wherever one exists, so the two
 * dashboards can be read side by side without having to explain a difference.
 */
@Injectable()
export class MyDashboardService {
  private readonly logger = new Logger(MyDashboardService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly utilityService: UtilityService,
    private readonly dateTimeService: DateTimeService,
  ) {}

  // ──────────────────────────── small helpers ────────────────────────────

  private async one<T>(query: string, params: unknown[]): Promise<T | null> {
    const [row] = await this.dataSource.query(query, params);
    return (row as T) ?? null;
  }

  private async many<T>(query: string, params: unknown[]): Promise<T[]> {
    return (await this.dataSource.query(query, params)) as T[];
  }

  private async isDriver(userId: string): Promise<boolean> {
    const row = await this.one<{ has: boolean }>(q.userHasRoleQuery, [userId, Roles.DRIVER]);
    return Boolean(row?.has);
  }

  /** Today, and the first/last day of the month it falls in, as YYYY-MM-DD. */
  private monthBounds(offsetMonths = 0) {
    const today = this.dateTimeService.toDate(this.dateTimeService.getTodayString());
    const start = new Date(today.getFullYear(), today.getMonth() + offsetMonths, 1);
    const end = new Date(today.getFullYear(), today.getMonth() + offsetMonths + 1, 0);
    return { start: this.ymd(start), end: this.ymd(end) };
  }

  /**
   * Local calendar date as YYYY-MM-DD.
   *
   * Built from the local parts rather than `toISOString()`, which converts to UTC first and so
   * reports the previous day for anything before 05:30 in IST.
   */
  private ymd(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  /** Whole days from today until `date`; negative once it has passed. */
  private daysUntil(date: string | Date | null): number | null {
    if (!date) return null;
    const today = this.dateTimeService.toDate(this.dateTimeService.getTodayString());
    const target = typeof date === 'string' ? this.dateTimeService.toDate(date) : new Date(date);
    const dayMs = 24 * 60 * 60 * 1000;
    return Math.round(
      (Date.UTC(target.getFullYear(), target.getMonth(), target.getDate()) -
        Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) /
        dayMs,
    );
  }

  /**
   * The auto-penalty window, read from the same config row the penalty cron reads.
   *
   * Returns null when the penalty is switched off or the row cannot be read — the countdown is
   * then simply not shown, rather than a deadline being invented that nothing will enforce.
   */
  private async penaltyHours(): Promise<number | null> {
    try {
      const row = await this.one<{ value: unknown }>(q.handoverPenaltyConfigQuery, []);
      const value = row?.value as { enabled?: boolean; hours?: number } | undefined;
      if (!value || value.enabled !== true) return null;
      const hours = Number(value.hours);
      return Number.isFinite(hours) && hours > 0 ? hours : null;
    } catch (error) {
      this.logger.warn(`Handover penalty config unreadable: ${(error as Error).message}`);
      return null;
    }
  }

  /** Hours left before the window closes, floored at zero. */
  private hoursLeft(offeredAt: string | Date, windowHours: number | null): number | null {
    if (windowHours === null) return null;
    const offered = new Date(offeredAt).getTime();
    const deadline = offered + windowHours * 60 * 60 * 1000;
    return Math.max(0, Math.round(((deadline - Date.now()) / (60 * 60 * 1000)) * 10) / 10);
  }

  // ──────────────────────────── attendance ────────────────────────────

  async getAttendance(userId: string): Promise<MyAttendanceData> {
    const today = this.dateTimeService.getTodayString();
    const thisMonth = this.monthBounds(0);
    const prevMonth = this.monthBounds(-1);

    const [row, current, last] = await Promise.all([
      this.one<any>(q.myDayAttendanceQuery, [userId, today]),
      this.one<MyAttendanceCounts>(q.myAttendanceCountsQuery, [
        userId,
        thisMonth.start,
        thisMonth.end,
      ]),
      this.one<MyAttendanceCounts>(q.myAttendanceCountsQuery, [
        userId,
        prevMonth.start,
        prevMonth.end,
      ]),
    ]);

    const empty: MyAttendanceCounts = {
      daysRecorded: 0,
      worked: 0,
      present: 0,
      absent: 0,
      onLeave: 0,
      halfDay: 0,
      holiday: 0,
      approvalPending: 0,
    };

    return {
      today: {
        // No row is a real answer on a day nobody has checked in yet, not a failure.
        status: row?.status ?? null,
        approvalStatus: row?.approvalStatus ?? null,
        checkInTime: row?.checkInTime ?? null,
        checkOutTime: row?.checkOutTime ?? null,
        attendanceType: row?.attendanceType ?? null,
        site: row?.siteId ? { id: row.siteId, name: row.siteName } : null,
      },
      currentMonth: current ?? empty,
      lastMonth: last ?? empty,
    };
  }

  // ──────────────────────────── leave ────────────────────────────

  async getLeave(userId: string): Promise<MyLeaveData> {
    const today = this.dateTimeService.getTodayString();
    const financialYear = this.utilityService.getFinancialYear(this.dateTimeService.toDate(today));

    const [balances, applications] = await Promise.all([
      this.many<any>(q.myLeaveBalancesQuery, [userId, financialYear]),
      this.one<any>(q.myLeaveApplicationsQuery, [userId, today]),
    ]);

    return {
      financialYear,
      balances,
      totalBalance: balances.reduce((sum, b) => sum + Number(b.balance ?? 0), 0),
      pendingCount: Number(applications?.pendingCount ?? 0),
      upcomingApprovedCount: Number(applications?.upcomingApprovedCount ?? 0),
      upcomingApprovedDays: Number(applications?.upcomingApprovedDays ?? 0),
      nextLeaveFrom: applications?.nextLeaveFrom ?? null,
    };
  }

  // ──────────────────────────── money ────────────────────────────

  async getExpense(userId: string): Promise<MyExpenseData> {
    const month = this.monthBounds(0);

    const [settlement, summary, byCategory, driver] = await Promise.all([
      this.one<any>(q.myPendingSettlementQuery, [userId]),
      this.one<any>(q.myExpenseSummaryQuery, [userId, month.start, month.end]),
      this.many<any>(q.myExpenseByCategoryQuery, [userId, month.start, month.end]),
      this.isDriver(userId),
    ]);

    const approved = Number(settlement?.approved ?? 0);
    const settled = Number(settlement?.settled ?? 0);

    return {
      settlement: {
        approved,
        settled,
        // Can go negative when an advance has been paid; reported as-is rather than clamped, so
        // "the company owes me" and "I owe the company" stay tellable apart.
        pending: Number((approved - settled).toFixed(2)),
      },
      currentMonth: {
        claims: Number(summary?.claims ?? 0),
        total: Number(summary?.total ?? 0),
        pendingCount: Number(summary?.pendingCount ?? 0),
        pendingAmount: Number(summary?.pendingAmount ?? 0),
        approvedCount: Number(summary?.approvedCount ?? 0),
        approvedAmount: Number(summary?.approvedAmount ?? 0),
        rejectedCount: Number(summary?.rejectedCount ?? 0),
        rejectedAmount: Number(summary?.rejectedAmount ?? 0),
      },
      byCategory,
      foodAllowance: driver
        ? await this.one<any>(q.myFoodAllowanceQuery, [userId, month.start, month.end])
        : null,
    };
  }

  // ──────────────────────────── project ────────────────────────────

  async getProject(userId: string): Promise<MyProjectData> {
    const today = this.dateTimeService.getTodayString();
    const [current, history] = await Promise.all([
      this.one<any>(q.myCurrentProjectQuery, [userId, today]),
      this.many<any>(q.myProjectHistoryQuery, [userId, PROJECT_HISTORY_LIMIT]),
    ]);
    // Null is the normal answer for anyone the office has not allocated — not an error.
    return { current, history };
  }

  // ──────────────────────────── assets ────────────────────────────

  async getAssets(userId: string): Promise<MyAssetsData> {
    const [assets, offers, sent, windowHours] = await Promise.all([
      this.many<any>(q.myAssetsQuery, [userId]),
      this.many<any>(q.myPendingAssetHandoversQuery, [userId]),
      this.many<any>(q.myOutgoingAssetHandoversQuery, [userId]),
      this.penaltyHours(),
    ]);

    return {
      assets: assets.map((a) => ({
        ...a,
        calibrationDaysLeft: this.daysUntil(a.calibrationEndDate),
        warrantyDaysLeft: this.daysUntil(a.warrantyEndDate),
      })),
      pendingHandovers: offers.map(
        (o): PendingHandover => ({
          id: o.id,
          label: o.name ? `${o.assetId} — ${o.name}` : o.assetId,
          offeredAt: o.offeredAt,
          offeredBy: o.offeredBy || null,
          hoursLeft: this.hoursLeft(o.offeredAt, windowHours),
        }),
      ),
      outgoingHandovers: sent.map(
        (o): OutgoingHandover => ({
          id: o.id,
          label: o.name ? `${o.assetId} — ${o.name}` : o.assetId,
          offeredAt: o.offeredAt,
          waitingOn: o.waitingOn || null,
        }),
      ),
    };
  }

  // ──────────────────────────── vehicle ────────────────────────────

  async getVehicle(userId: string): Promise<MyVehicleData> {
    const [isDriver, vehicle, offers, sent, windowHours] = await Promise.all([
      this.isDriver(userId),
      this.one<any>(q.myVehicleQuery, [userId]),
      this.many<any>(q.myPendingVehicleHandoversQuery, [userId]),
      this.many<any>(q.myOutgoingVehicleHandoversQuery, [userId]),
      this.penaltyHours(),
    ]);

    // `isDriver` is returned rather than refusing a non-driver: the card is simply hidden, and an
    // empty answer is indistinguishable from "driver with no vehicle" without it.
    return {
      isDriver,
      vehicle: vehicle
        ? {
            ...vehicle,
            insuranceDaysLeft: this.daysUntil(vehicle.insuranceEndDate),
            pucDaysLeft: this.daysUntil(vehicle.pucEndDate),
            fitnessDaysLeft: this.daysUntil(vehicle.fitnessEndDate),
          }
        : null,
      pendingHandovers: offers.map(
        (o): PendingHandover => ({
          id: o.id,
          label: o.registrationNo,
          offeredAt: o.offeredAt,
          offeredBy: o.offeredBy || null,
          hoursLeft: this.hoursLeft(o.offeredAt, windowHours),
        }),
      ),
      outgoingHandovers: sent.map(
        (o): OutgoingHandover => ({
          id: o.id,
          label: o.registrationNo,
          offeredAt: o.offeredAt,
          waitingOn: o.waitingOn || null,
        }),
      ),
    };
  }

  // ──────────────────────────── fuel ────────────────────────────

  async getFuel(userId: string): Promise<MyFuelData> {
    const month = this.monthBounds(0);
    const [isDriver, summary] = await Promise.all([
      this.isDriver(userId),
      this.one<any>(q.myFuelSummaryQuery, [userId, month.start, month.end]),
    ]);

    return {
      isDriver,
      currentMonth: {
        entries: Number(summary?.entries ?? 0),
        amount: Number(summary?.amount ?? 0),
        liters: Number(summary?.liters ?? 0),
        pendingCount: Number(summary?.pendingCount ?? 0),
        pendingAmount: Number(summary?.pendingAmount ?? 0),
        approvedCount: Number(summary?.approvedCount ?? 0),
        rejectedCount: Number(summary?.rejectedCount ?? 0),
        // Kept apart on purpose: PetroCard spend comes out of the company wallet, not the
        // driver's pocket, and adding the two together would misstate both.
        petroCardCount: Number(summary?.petroCardCount ?? 0),
        petroCardAmount: Number(summary?.petroCardAmount ?? 0),
        ownPaidAmount: Number(summary?.ownPaidAmount ?? 0),
      },
    };
  }

  // ──────────────────────────── alerts ────────────────────────────

  /**
   * Only things this person can act on themselves.
   *
   * The admin dashboard's alerts are about other people's problems; these are about the reader's
   * own, which is the whole difference between the two dashboards.
   */
  async getAlerts(userId: string): Promise<MyAlertsData> {
    const [assets, vehicle, attendance, leave] = await Promise.all([
      this.getAssets(userId),
      this.getVehicle(userId),
      this.getAttendance(userId),
      this.getLeave(userId),
    ]);

    const alerts: MyAlert[] = [];

    const handover = (h: PendingHandover, kind: string, what: string) =>
      alerts.push({
        type: `handover-${kind}`,
        // A countdown that has run out is about to cost money, so it outranks one that has not.
        severity: h.hoursLeft !== null && h.hoursLeft <= 12 ? 'critical' : 'warning',
        message:
          h.hoursLeft === null
            ? `${what} ${h.label} is waiting for you to accept.`
            : `${what} ${h.label} is waiting for you to accept — ${h.hoursLeft} hour(s) left before it is accepted for you and a penalty is charged.`,
        countdown: h.hoursLeft,
      });

    assets.pendingHandovers.forEach((h) => handover(h, 'asset', 'Asset'));
    vehicle.pendingHandovers.forEach((h) => handover(h, 'vehicle', 'Vehicle'));

    if (attendance.currentMonth.approvalPending > 0) {
      alerts.push({
        type: 'attendance-approval',
        severity: 'info',
        message: `${attendance.currentMonth.approvalPending} attendance day(s) this month are waiting for approval.`,
        countdown: null,
      });
    }

    leave.balances
      .filter((b) => b.balance <= LOW_LEAVE_BALANCE_DAYS)
      .forEach((b) =>
        alerts.push({
          type: 'leave-low',
          severity: 'info',
          message: `Your ${b.leaveCategory} leave balance is down to ${b.balance} day(s).`,
          countdown: b.balance,
        }),
      );

    const expiring = (label: string, days: number | null) => {
      if (days === null || days > EXPIRY_WARNING_DAYS) return;
      alerts.push({
        type: 'document-expiry',
        severity: days < 0 ? 'critical' : 'warning',
        message:
          days < 0
            ? `${label} expired ${Math.abs(days)} day(s) ago.`
            : `${label} expires in ${days} day(s).`,
        countdown: days,
      });
    };

    if (vehicle.vehicle) {
      const v = vehicle.vehicle;
      expiring(`Insurance on ${v.registrationNo}`, v.insuranceDaysLeft);
      expiring(`PUC on ${v.registrationNo}`, v.pucDaysLeft);
      expiring(`Fitness on ${v.registrationNo}`, v.fitnessDaysLeft);
    }
    assets.assets.forEach((a) => {
      expiring(`Calibration on ${a.assetId}`, a.calibrationDaysLeft);
      expiring(`Warranty on ${a.assetId}`, a.warrantyDaysLeft);
    });

    const counts = {
      critical: alerts.filter((a) => a.severity === 'critical').length,
      warning: alerts.filter((a) => a.severity === 'warning').length,
      info: alerts.filter((a) => a.severity === 'info').length,
      total: alerts.length,
    };

    // Most urgent first, so a card that shows only the top few shows the right few.
    const rank = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => rank[a.severity] - rank[b.severity]);

    return { alerts, counts };
  }
}
