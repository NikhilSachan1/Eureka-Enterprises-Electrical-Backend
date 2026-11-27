import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { ConfigurationService } from '../configurations/configuration.service';
import { ConfigSettingService } from '../config-settings/config-setting.service';
import {
  CONFIGURATION_KEYS,
  CONFIGURATION_MODULES,
} from 'src/utils/master-constants/master-constants';
import { AttendanceEntity } from '../attendance/entities/attendance.entity';
import { AttendanceStatus } from '../attendance/constants/attendance.constants';
import { LeaveLedgerService } from './leave-ledger.service';
import {
  ACCRUAL_CONFIG_CACHE_MS,
  DEFAULT_WORKING_DAYS_SETTINGS,
  FY_START_MONTH,
  LEAVE_LEDGER_ERRORS,
  LEAVE_LEDGER_REASONS,
  LWP_ATTENDANCE_COMMENT,
  LeaveLedgerEntryType,
  MONTH_SHORT_NAMES,
  POSTGRES_UNIQUE_VIOLATION,
  SETTLED_ENTRY_TYPES,
} from './constants/leave-ledger.constants';
import {
  AccrualSettings,
  AccrualUser,
  AttendanceCountRow,
  AttendanceCounts,
  CachedValue,
  ConvertibleLeaveDay,
  LedgerEntryView,
  LeaveLedgerView,
  MonthAttendance,
  MonthCounts,
  MonthlySettlementResult,
  SettlementOutcome,
  WorkingDaysSettings,
} from './types/leave-ledger.types';
import {
  convertibleLeaveDaysQuery,
  getAccrualUsersQuery,
  ledgerEntriesQuery,
  monthlyAttendanceCountsQuery,
  sumEntriesQuery,
} from './queries/leave-ledger.queries';

/**
 * Leave is earned from attendance, the way salary is paid:
 *
 *   earned(month) = annualQuota / 12 × paidDays / workingDays
 *   paidDays      = present + half day × 0.5 + paid leave   (absent and LWP earn nothing)
 *
 * On 1 April (and in the joining month) the month's leave is credited in advance so it can be
 * used straight away. Every other month is credited after it ends. On the 1st of each month the
 * finished months are settled: the year's earned total (rounded down to whole days, or half days
 * when fractional leave is on) is compared with what was credited, and the difference posted.
 * Re-running is harmless: a month already settled posts nothing, and a corrected attendance day
 * is picked up at the next run.
 *
 * The balance never goes below 0: when settlement has to take back more than is left, that
 * month's paid leave days become LWP (latest first) until it fits.
 */
@Injectable()
export class LeaveAccrualService {
  private readonly logger = new Logger(LeaveAccrualService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly ledger: LeaveLedgerService,
    private readonly configurationService: ConfigurationService,
    private readonly configSettingService: ConfigSettingService,
  ) {}

  // ==================== Monthly run ====================

  /**
   * The 1st-of-month run: settles every month up to the one before `asOf`, then, on 1 April,
   * credits the new year's April advance.
   */
  async runMonthly(asOf: string, onlyUserIds?: string[]): Promise<MonthlySettlementResult> {
    const throughMonth = this.addMonths(this.monthOf(asOf), -1);
    const financialYear = this.financialYearOfMonth(throughMonth);
    const result: MonthlySettlementResult = {
      financialYear,
      settledThrough: throughMonth,
      usersProcessed: 0,
      credited: 0,
      clawedBack: 0,
      convertedToLwp: 0,
      unrecovered: 0,
      advancesGiven: 0,
      credits: [],
      errors: [],
    };

    const users = await this.getAccrualUsers(onlyUserIds);
    const settings = await this.getSettings(financialYear);
    if (settings && users.length) {
      const counts = await this.loadAttendance(
        users.map((u) => u.id),
        this.fyStartMonth(financialYear),
        throughMonth,
      );
      for (const user of users) {
        for (const { category, annualQuota } of settings.categories) {
          try {
            const outcome = await this.settleUser(
              user,
              category,
              annualQuota,
              settings,
              throughMonth,
              counts,
            );
            result.credited += Math.max(0, outcome.posted);
            result.clawedBack += Math.max(0, -outcome.posted);
            if (outcome.posted > 0) {
              result.credits.push({
                userId: user.id,
                leaveCategory: category,
                days: outcome.posted,
                availableAfter: outcome.availableAfter,
                month: this.monthLabel(throughMonth),
              });
            }
            result.convertedToLwp += outcome.converted;
            result.unrecovered += outcome.unrecovered;
          } catch (error) {
            result.errors.push(`User ${user.id}, ${category}: ${error.message}`);
            this.logger.error(`Settlement failed for ${user.id} ${category}`, error);
          }
        }
      }
      result.usersProcessed = users.length;
    } else if (!settings) {
      result.errors.push(
        LEAVE_LEDGER_ERRORS.CONFIG_NOT_FOUND.replace('{financialYear}', financialYear),
      );
    }

    const currentMonth = this.monthOf(asOf);
    if (Number(currentMonth.slice(5, 7)) === FY_START_MONTH) {
      result.advancesGiven = await this.grantAprilAdvances(currentMonth, users, result.errors);
    }

    return result;
  }

  private async settleUser(
    user: AccrualUser,
    category: string,
    annualQuota: number,
    settings: AccrualSettings,
    throughMonth: string,
    counts: AttendanceCounts,
  ): Promise<SettlementOutcome> {
    const { financialYear } = settings;
    const windowStart = this.settlementWindowStart(user, financialYear);
    const months =
      windowStart > throughMonth
        ? []
        : await this.buildMonths(user.id, windowStart, throughMonth, annualQuota, counts);

    return this.ledger.inTransaction(undefined, async (em) => {
      const credited = await this.sumEntries(
        em,
        user.id,
        category,
        financialYear,
        SETTLED_ENTRY_TYPES,
        throughMonth,
      );
      let target = this.floorToStep(this.totalEarned(months), settings.step);
      let diff = this.ledger.round(target - credited);
      if (Math.abs(diff) < 1e-9) {
        return { posted: 0, converted: 0, unrecovered: 0, availableAfter: 0 };
      }

      const convertedDates: string[] = [];
      if (diff < 0) {
        const balance = await this.ledger.lockBalance(user.id, category, financialYear, em);
        let available = balance.available;
        if (available + diff < 0 && months.length) {
          const candidates = convertibleLeaveDaysQuery(
            user.id,
            category,
            `${windowStart}-01`,
            this.monthEndDate(throughMonth),
          );
          const days: ConvertibleLeaveDay[] = await em.query(candidates.query, candidates.params);

          for (const day of days) {
            if (available + diff >= 0) break;
            await this.convertToLwp(day, user.id, category, financialYear, throughMonth, em);
            available += 1;
            convertedDates.push(day.date);

            const month = months.find((m) => m.month === day.date.slice(0, 7));
            if (month) {
              month.paidLeaveDays -= 1;
              this.recomputeMonth(month, annualQuota);
            }
            target = this.floorToStep(this.totalEarned(months), settings.step);
            diff = this.ledger.round(target - credited);
          }
        }
      }

      const reasonTemplate =
        diff >= 0 ? LEAVE_LEDGER_REASONS.ACCRUAL : LEAVE_LEDGER_REASONS.ACCRUAL_CLAWBACK;
      const posted = await this.ledger.post(
        {
          userId: user.id,
          leaveCategory: category,
          financialYear,
          entryType: LeaveLedgerEntryType.MONTHLY_ACCRUAL,
          days: diff,
          periodMonth: `${throughMonth}-01`,
          reason: reasonTemplate.replace('{month}', this.monthLabel(throughMonth)),
          metadata: {
            months,
            target,
            creditedBefore: credited,
            ...(convertedDates.length && { convertedDates }),
          },
        },
        em,
        { clampToZero: true },
      );

      const unrecovered = this.ledger.round(posted - diff);
      if (unrecovered > 0) {
        this.logger.warn(
          `User ${user.id} ${category}: ${unrecovered} day(s) over-used and not recoverable through ${throughMonth}`,
        );
      }
      const after = await this.ledger.lockBalance(user.id, category, financialYear, em);
      return {
        posted,
        converted: convertedDates.length,
        unrecovered,
        availableAfter: this.ledger.round(after.available),
      };
    });
  }

  /** Turns one approved paid leave day into LWP: a new attendance row, the old one kept inactive. */
  private async convertToLwp(
    day: ConvertibleLeaveDay,
    userId: string,
    category: string,
    financialYear: string,
    throughMonth: string,
    em: EntityManager,
  ): Promise<void> {
    const repository = em.getRepository(AttendanceEntity);
    const current = await repository.findOne({ where: { id: day.attendanceId } });
    if (!current) return;

    await repository.update({ id: current.id }, { isActive: false });
    const replacement = await repository.save(
      repository.create({
        userId: current.userId,
        attendanceDate: current.attendanceDate,
        checkInTime: current.checkInTime,
        checkOutTime: current.checkOutTime,
        status: AttendanceStatus.LEAVE_WITHOUT_PAY,
        shiftConfigId: current.shiftConfigId,
        entrySourceType: current.entrySourceType,
        attendanceType: current.attendanceType,
        regularizedBy: current.regularizedBy,
        approvalStatus: current.approvalStatus,
        approvalBy: current.approvalBy,
        approvalAt: current.approvalAt,
        approvalComment: LWP_ATTENDANCE_COMMENT,
        notes: current.notes,
        assignmentSnapshot: current.assignmentSnapshot,
        isActive: true,
      }),
    );

    await this.ledger.post(
      {
        userId,
        leaveCategory: category,
        financialYear,
        entryType: LeaveLedgerEntryType.LWP_CONVERSION,
        days: 1,
        periodMonth: `${throughMonth}-01`,
        leaveApplicationId: day.leaveApplicationId,
        attendanceId: replacement.id,
        reason: LEAVE_LEDGER_REASONS.LWP_CONVERSION.replace('{date}', day.date).replace(
          '{month}',
          this.monthLabel(throughMonth),
        ),
      },
      em,
    );
  }

  // ==================== Advances ====================

  private async grantAprilAdvances(
    aprilMonth: string,
    users: AccrualUser[],
    errors: string[],
  ): Promise<number> {
    const financialYear = this.financialYearOfMonth(aprilMonth);
    const settings = await this.getSettings(financialYear);
    if (!settings || !users.length) {
      if (!settings) {
        errors.push(LEAVE_LEDGER_ERRORS.CONFIG_NOT_FOUND.replace('{financialYear}', financialYear));
      }
      return 0;
    }

    const march = this.addMonths(aprilMonth, -1);
    const marchCounts = await this.loadAttendance(
      users.map((u) => u.id),
      march,
      march,
    );

    let given = 0;
    for (const user of users) {
      const doj = user.dateOfJoining;
      if (doj && this.monthOf(doj) > aprilMonth) continue; // joins later: joining advance

      // Present in March at all? An employee who did not come in March gets no advance.
      if (doj && doj < `${march}-01`) {
        const [marchMonth] = await this.buildMonths(user.id, march, march, 12, marchCounts);
        if (marchMonth && marchMonth.paidDays <= 0) continue;
      }

      const fromDate = doj && this.monthOf(doj) === aprilMonth ? doj : `${aprilMonth}-01`;
      for (const { category, annualQuota } of settings.categories) {
        try {
          const ok = await this.postAdvance(
            user.id,
            category,
            annualQuota,
            settings,
            aprilMonth,
            fromDate,
            LEAVE_LEDGER_REASONS.ADVANCE_APRIL.replace('{month}', this.monthLabel(aprilMonth)),
            null,
          );
          if (ok) given++;
        } catch (error) {
          errors.push(`Advance ${user.id}, ${category}: ${error.message}`);
        }
      }
    }
    return given;
  }

  /**
   * The joining-month advance, credited when the employee is created: the joining month's share
   * from the joining date (or the current month in full, for a back-dated joining date).
   */
  async grantJoiningAdvance(
    userId: string,
    dateOfJoining: string,
    today: string,
    createdBy: string,
    entityManager?: EntityManager,
  ): Promise<void> {
    const currentMonth = this.monthOf(today);
    const joiningMonth = this.monthOf(dateOfJoining);
    const advanceMonth = joiningMonth >= currentMonth ? joiningMonth : currentMonth;
    const fromDate = joiningMonth === advanceMonth ? dateOfJoining : `${advanceMonth}-01`;
    const financialYear = this.financialYearOfMonth(advanceMonth);

    const settings = await this.getSettings(financialYear);
    if (!settings) {
      this.logger.warn(
        `No leave config for ${financialYear}; joining advance skipped for ${userId}`,
      );
      return;
    }

    for (const { category, annualQuota } of settings.categories) {
      await this.postAdvance(
        userId,
        category,
        annualQuota,
        settings,
        advanceMonth,
        fromDate,
        LEAVE_LEDGER_REASONS.ADVANCE_JOINING.replace(
          '{month}',
          this.monthLabel(advanceMonth),
        ).replace('{fromDate}', fromDate),
        createdBy,
        entityManager,
      );
    }
  }

  private async postAdvance(
    userId: string,
    category: string,
    annualQuota: number,
    settings: AccrualSettings,
    month: string,
    fromDate: string,
    reason: string,
    createdBy: string | null,
    entityManager?: EntityManager,
  ): Promise<boolean> {
    const wd = await this.getWorkingDaysSettings();
    const holidays = await this.getHolidays(settings.financialYear);
    const fullMonth = this.workingDays(month, wd, holidays, 1);
    const fromDay = Number(fromDate.slice(8, 10)) || 1;
    const share = fullMonth > 0 ? this.workingDays(month, wd, holidays, fromDay) / fullMonth : 0;
    const days = this.floorToStep((annualQuota / 12) * share, settings.step);
    if (days <= 0) return false;

    try {
      await this.ledger.inTransaction(entityManager, (em) =>
        this.ledger.post(
          {
            userId,
            leaveCategory: category,
            financialYear: settings.financialYear,
            entryType: LeaveLedgerEntryType.ADVANCE_CREDIT,
            days,
            periodMonth: `${month}-01`,
            reason,
            createdBy,
          },
          em,
        ),
      );
      return true;
    } catch (error) {
      if (
        error?.code === POSTGRES_UNIQUE_VIOLATION ||
        error?.driverError?.code === POSTGRES_UNIQUE_VIOLATION
      ) {
        return false; // already has this year's advance
      }
      throw error;
    }
  }

  // ==================== Ledger view ====================

  async getLedgerView(
    userId: string,
    financialYear: string,
    today: string,
    leaveCategory?: string,
  ): Promise<LeaveLedgerView> {
    const settings = await this.getSettings(financialYear);
    const category = leaveCategory ?? settings?.categories[0]?.category ?? 'earned';
    const quota = settings?.categories.find((c) => c.category === category)?.annualQuota ?? 0;

    const entriesQuery = ledgerEntriesQuery(userId, category, financialYear);
    const rows: Omit<LedgerEntryView, 'balanceAfter'>[] = await this.dataSource.query(
      entriesQuery.query,
      entriesQuery.params,
    );

    let running = 0;
    let credited = 0;
    let used = 0;
    const entries = rows.map((row) => {
      running = this.ledger.round(running + row.days);
      if (this.ledger.isAllocation(row.entryType)) credited += row.days;
      else used -= row.days;
      return { ...row, balanceAfter: running };
    });

    const [user] = await this.dataSource.query(
      `SELECT to_char("dateOfJoining", 'YYYY-MM-DD') AS "dateOfJoining" FROM users WHERE id = $1`,
      [userId],
    );
    const fyStart = this.fyStartMonth(financialYear);
    const fyEnd = this.addMonths(fyStart, 11);
    const doj: string | null = user?.dateOfJoining ?? null;
    const first = doj && this.monthOf(doj) > fyStart ? this.monthOf(doj) : fyStart;
    const last = this.monthOf(today) < fyEnd ? this.monthOf(today) : fyEnd;

    let months: LeaveLedgerView['months'] = [];
    if (first <= last && quota > 0) {
      const counts = await this.loadAttendance([userId], first, last);
      const built = await this.buildMonths(userId, first, last, quota, counts);
      months = built.map((m) => ({
        ...m,
        credited: this.ledger.round(
          entries
            .filter(
              (e) =>
                e.periodMonth?.slice(0, 7) === m.month &&
                (SETTLED_ENTRY_TYPES.includes(e.entryType) ||
                  e.entryType === LeaveLedgerEntryType.HOLIDAY_WORK_CREDIT),
            )
            .reduce((sum, e) => sum + e.days, 0),
        ),
      }));
    }

    return {
      userId,
      leaveCategory: category,
      financialYear,
      summary: {
        credited: this.ledger.round(credited),
        used: this.ledger.round(used),
        available: running,
      },
      months: months.reverse(),
      entries: entries.reverse(),
    };
  }

  // ==================== Building blocks ====================

  /** First month the settlement measures: FY start, or the joining month. */
  private settlementWindowStart(user: AccrualUser, financialYear: string): string {
    const start = this.fyStartMonth(financialYear);
    const joining = user.dateOfJoining ? this.monthOf(user.dateOfJoining) : null;
    return joining && joining > start ? joining : start;
  }

  private async buildMonths(
    userId: string,
    fromMonth: string,
    toMonth: string,
    annualQuota: number,
    counts: AttendanceCounts,
  ): Promise<MonthAttendance[]> {
    const wd = await this.getWorkingDaysSettings();
    const result: MonthAttendance[] = [];
    for (const month of this.monthRange(fromMonth, toMonth)) {
      const holidays = await this.getHolidays(this.financialYearOfMonth(month));
      const c: MonthCounts = counts.get(userId)?.get(month) ?? {
        presentDays: 0,
        halfDays: 0,
        paidLeaveDays: 0,
      };
      const entry: MonthAttendance = {
        month,
        workingDays: this.workingDays(month, wd, holidays, 1),
        presentDays: c.presentDays,
        halfDays: c.halfDays,
        paidLeaveDays: c.paidLeaveDays,
        paidDays: 0,
        earned: 0,
      };
      this.recomputeMonth(entry, annualQuota);
      result.push(entry);
    }
    return result;
  }

  private recomputeMonth(month: MonthAttendance, annualQuota: number): void {
    const raw = month.presentDays + month.halfDays * 0.5 + month.paidLeaveDays;
    month.paidDays = Math.min(raw, month.workingDays);
    month.earned =
      month.workingDays > 0
        ? Math.round((annualQuota / 12) * (month.paidDays / month.workingDays) * 10000) / 10000
        : 0;
  }

  private async loadAttendance(
    userIds: string[],
    fromMonth: string,
    toMonth: string,
  ): Promise<AttendanceCounts> {
    const counts: AttendanceCounts = new Map();
    if (!userIds.length || fromMonth > toMonth) return counts;

    const q = monthlyAttendanceCountsQuery(userIds, `${fromMonth}-01`, this.monthEndDate(toMonth));
    const rows: AttendanceCountRow[] = await this.dataSource.query(q.query, q.params);

    for (const row of rows) {
      const byMonth = counts.get(row.userId) ?? new Map<string, MonthCounts>();
      counts.set(row.userId, byMonth);
      byMonth.set(row.month, {
        presentDays: Number(row.presentDays) || 0,
        halfDays: Number(row.halfDays) || 0,
        paidLeaveDays: Number(row.paidLeaveDays) || 0,
      });
    }
    return counts;
  }

  private async getAccrualUsers(userIds?: string[]): Promise<AccrualUser[]> {
    const q = getAccrualUsersQuery(userIds);
    return this.dataSource.query(q.query, q.params);
  }

  private async sumEntries(
    em: EntityManager,
    userId: string,
    category: string,
    financialYear: string,
    types: readonly LeaveLedgerEntryType[],
    throughMonth?: string,
  ): Promise<number> {
    const q = sumEntriesQuery(userId, category, financialYear, types, throughMonth);
    const [{ total }] = await em.query(q.query, q.params);
    return this.ledger.round(Number(total) || 0);
  }

  /** Monthly-credited categories with a quota, for one financial year. */
  async getSettings(financialYear: string): Promise<AccrualSettings | null> {
    const categoriesValue = await this.getConfigValue(
      CONFIGURATION_MODULES.LEAVE,
      CONFIGURATION_KEYS.LEAVE_CATEGORIES_CONFIG,
      financialYear,
    );
    const leaveConfigId = await this.ledger.getLeaveConfigSettingId(financialYear);
    if (!categoriesValue || !leaveConfigId) return null;

    const calendar = await this.getConfigValue(
      CONFIGURATION_MODULES.LEAVE,
      CONFIGURATION_KEYS.CALENDAR_SETTINGS,
      financialYear,
    );

    const categories = Object.entries(categoriesValue as Record<string, any>)
      .map(([category, value]) => ({ category, config: value?.actual ?? value?.default }))
      .filter(({ config }) => config && (config.creditFrequency ?? 'monthly') === 'monthly')
      .map(({ category, config }) => ({ category, annualQuota: Number(config.annualQuota) || 0 }))
      .filter(({ annualQuota }) => annualQuota > 0);

    return {
      financialYear,
      leaveConfigId,
      categories,
      step: calendar?.allowFractional ? 0.5 : 1,
    };
  }

  private readonly configCache = new Map<string, CachedValue<unknown>>();

  /** Short-lived cache: settlement asks for the same settings once per employee and month. */
  private async cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.configCache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.value as T;
    const value = await load();
    this.configCache.set(key, { value, expiresAt: Date.now() + ACCRUAL_CONFIG_CACHE_MS });
    return value;
  }

  private getWorkingDaysSettings(): Promise<WorkingDaysSettings> {
    return this.cached('working-days', async () => {
      const value = await this.getConfigValue(
        CONFIGURATION_MODULES.PAYROLL,
        CONFIGURATION_KEYS.PAYROLL_WORKING_DAYS_CALCULATION,
      );
      return {
        excludeSundays: value?.excludeSundays ?? DEFAULT_WORKING_DAYS_SETTINGS.excludeSundays,
        excludeSaturdays: value?.excludeSaturdays ?? DEFAULT_WORKING_DAYS_SETTINGS.excludeSaturdays,
        useHolidayCalendar:
          value?.useHolidayCalendar ?? DEFAULT_WORKING_DAYS_SETTINGS.useHolidayCalendar,
        defaultWorkingDays:
          Number(value?.defaultWorkingDays) || DEFAULT_WORKING_DAYS_SETTINGS.defaultWorkingDays,
      };
    });
  }

  private getHolidays(financialYear: string): Promise<Set<string>> {
    return this.cached(`holidays:${financialYear}`, async () => {
      const value = await this.getConfigValue(
        CONFIGURATION_MODULES.LEAVE,
        CONFIGURATION_KEYS.HOLIDAY_CALENDAR,
        financialYear,
      );
      const holidays: Array<string | { date?: string }> = value?.holidays ?? [];
      return new Set(
        holidays.map((h) => (typeof h === 'string' ? h : h?.date)).filter((d): d is string => !!d),
      );
    });
  }

  /** Working days of a month from `fromDay`, the way payroll counts them. */
  private workingDays(
    month: string,
    settings: WorkingDaysSettings,
    holidays: Set<string>,
    fromDay: number,
  ): number {
    const [year, mon] = month.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate();
    let count = 0;
    for (let day = fromDay; day <= daysInMonth; day++) {
      const weekday = new Date(Date.UTC(year, mon - 1, day)).getUTCDay();
      if (settings.excludeSundays && weekday === 0) continue;
      if (settings.excludeSaturdays && weekday === 6) continue;
      const date = `${month}-${String(day).padStart(2, '0')}`;
      if (settings.useHolidayCalendar && holidays.has(date)) continue;
      count++;
    }
    return fromDay <= 1 && count === 0 ? settings.defaultWorkingDays : count;
  }

  private async getConfigValue(module: string, key: string, contextKey?: string): Promise<any> {
    const config = await this.configurationService.findOne({ where: { module, key } });
    if (!config) return null;
    const where = contextKey ? { configId: config.id, contextKey } : { configId: config.id };
    const setting =
      (await this.configSettingService.findOne({ where: { ...where, isActive: true } })) ??
      (contextKey ? await this.configSettingService.findOne({ where }) : null);
    return setting?.value ?? null;
  }

  // ==================== Month arithmetic (YYYY-MM strings, no time zones) ====================

  private totalEarned(months: MonthAttendance[]): number {
    return months.reduce((sum, m) => sum + m.earned, 0);
  }

  private floorToStep(value: number, step: number): number {
    return Math.floor(value / step + 1e-9) * step;
  }

  monthOf(isoDate: string): string {
    return isoDate.slice(0, 7);
  }

  addMonths(month: string, delta: number): string {
    const [year, mon] = month.split('-').map(Number);
    const index = year * 12 + (mon - 1) + delta;
    return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
  }

  private monthRange(from: string, to: string): string[] {
    const months: string[] = [];
    for (let m = from; m <= to; m = this.addMonths(m, 1)) months.push(m);
    return months;
  }

  private monthEndDate(month: string): string {
    const [year, mon] = month.split('-').map(Number);
    const last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
    return `${month}-${String(last).padStart(2, '0')}`;
  }

  private monthLabel(month: string): string {
    const [year, mon] = month.split('-').map(Number);
    return `${MONTH_SHORT_NAMES[mon - 1]} ${year}`;
  }

  fyStartMonth(financialYear: string): string {
    return `${financialYear.slice(0, 4)}-${String(FY_START_MONTH).padStart(2, '0')}`;
  }

  financialYearOfMonth(month: string): string {
    return this.ledger.financialYearOf(`${month}-01`);
  }
}
