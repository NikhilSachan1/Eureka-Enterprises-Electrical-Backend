import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { ConfigurationService } from '../configurations/configuration.service';
import { ConfigSettingService } from '../config-settings/config-setting.service';
import {
  CONFIGURATION_KEYS,
  CONFIGURATION_MODULES,
} from 'src/utils/master-constants/master-constants';
import { LeaveLedgerEntryEntity } from './entities/leave-ledger-entry.entity';
import {
  ALLOCATION_ENTRY_TYPES,
  LEAVE_LEDGER_ERRORS,
  LEAVE_LEDGER_REASONS,
  LeaveLedgerEntryType,
} from './constants/leave-ledger.constants';
import {
  LedgerEntryInput,
  LeaveDebitInput,
  LeaveReversalInput,
  LockedBalance,
} from './types/leave-ledger.types';
import {
  applicationForReversalQuery,
  applicationNetDaysQuery,
  createEmptyLeaveBalanceQuery,
  legacyCutoverQuery,
  lockLeaveBalanceQuery,
  syncLeaveBalanceFromLedgerQuery,
} from './queries/leave-ledger.queries';

/**
 * The only writer of leave balances. Every change is a ledger row; the leave_balances summary is
 * re-derived from the ledger in the same transaction, under a row lock, and a change that would
 * take the available balance below 0 is refused.
 */
@Injectable()
export class LeaveLedgerService {
  private readonly logger = new Logger(LeaveLedgerService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly configurationService: ConfigurationService,
    private readonly configSettingService: ConfigSettingService,
  ) {}

  /** Runs `work` in the caller's transaction, or a new one. */
  inTransaction<T>(
    entityManager: EntityManager | undefined,
    work: (em: EntityManager) => Promise<T>,
  ): Promise<T> {
    return entityManager ? work(entityManager) : this.dataSource.transaction(work);
  }

  async lockBalance(
    userId: string,
    leaveCategory: string,
    financialYear: string,
    em: EntityManager,
  ): Promise<LockedBalance> {
    const lock = lockLeaveBalanceQuery(userId, leaveCategory, financialYear);
    let [row] = await em.query(lock.query, lock.params);

    if (!row) {
      const leaveConfigId = await this.getLeaveConfigSettingId(financialYear);
      if (!leaveConfigId) {
        throw new BadRequestException(
          LEAVE_LEDGER_ERRORS.CONFIG_NOT_FOUND.replace('{financialYear}', financialYear),
        );
      }
      const create = createEmptyLeaveBalanceQuery(
        userId,
        leaveConfigId,
        leaveCategory,
        financialYear,
      );
      await em.query(create.query, create.params);
      [row] = await em.query(lock.query, lock.params);
    }

    const totalAllocated = Number(row.totalAllocated) || 0;
    const consumed = Number(row.consumed) || 0;
    return { id: row.id, totalAllocated, consumed, available: totalAllocated - consumed };
  }

  /**
   * Adds one ledger row and re-syncs the summary. A row that lowers the balance is refused when
   * the balance would go below 0, unless `clampToZero` is set: then it is cut to what is left.
   * Returns the days actually posted.
   */
  async post(
    input: LedgerEntryInput,
    em: EntityManager,
    options: { clampToZero?: boolean } = {},
  ): Promise<number> {
    const balance = await this.lockBalance(
      input.userId,
      input.leaveCategory,
      input.financialYear,
      em,
    );

    let days = this.round(input.days);
    if (days < 0 && balance.available + days < -1e-9) {
      if (!options.clampToZero) {
        throw new BadRequestException(
          LEAVE_LEDGER_ERRORS.INSUFFICIENT_BALANCE.replace('{leaveCategory}', input.leaveCategory)
            .replace('{available}', this.round(Math.max(0, balance.available)).toString())
            .replace('{days}', Math.abs(days).toString()),
        );
      }
      days = -this.round(Math.max(0, balance.available));
    }
    if (days === 0) {
      return 0;
    }

    await em.getRepository(LeaveLedgerEntryEntity).insert({
      userId: input.userId,
      leaveCategory: input.leaveCategory,
      financialYear: input.financialYear,
      entryType: input.entryType,
      days: days.toString(),
      periodMonth: input.periodMonth ?? null,
      leaveApplicationId: input.leaveApplicationId ?? null,
      attendanceId: input.attendanceId ?? null,
      reason: input.reason ?? null,
      metadata: input.metadata ?? null,
      createdBy: input.createdBy ?? null,
    });

    const sync = syncLeaveBalanceFromLedgerQuery(balance.id);
    await em.query(sync.query, sync.params);
    return days;
  }

  /** One day of a leave application taken from the balance. Refused when not enough is left. */
  async debitLeaveDay(input: LeaveDebitInput, entityManager?: EntityManager): Promise<void> {
    await this.inTransaction(entityManager, (em) =>
      this.post(
        {
          userId: input.userId,
          leaveCategory: input.leaveCategory,
          financialYear: input.financialYear,
          entryType: LeaveLedgerEntryType.LEAVE_DEBIT,
          days: -1,
          leaveApplicationId: input.leaveApplicationId,
          reason: LEAVE_LEDGER_REASONS.LEAVE_DEBIT.replace('{date}', input.leaveDate),
          createdBy: input.createdBy,
        },
        em,
      ),
    );
  }

  /**
   * Gives one day of a leave application back to the balance, never more days than it took.
   * Days an application took before the ledger existed (it predates the legacy opening) count
   * as taken. Returns false when there was nothing left to give back.
   */
  async reverseLeaveDay({
    leaveApplicationId,
    cause,
    createdBy,
    entityManager,
    leaveDate,
  }: LeaveReversalInput): Promise<boolean> {
    const [application] = await entityManager.query(applicationForReversalQuery.query, [
      leaveApplicationId,
    ]);
    if (!application) {
      return false;
    }

    const day = leaveDate ?? application.fromDate;
    // An application never crosses a financial year (apply refuses it).
    const financialYear = this.financialYearOf(application.fromDate);
    const net = applicationNetDaysQuery(leaveApplicationId);
    const [{ net: ledgerNet }] = await entityManager.query(net.query, net.params);

    const cutover = legacyCutoverQuery(
      application.userId,
      application.leaveCategory,
      financialYear,
    );
    const [legacy] = await entityManager.query(cutover.query, cutover.params);
    const legacyDays =
      legacy && new Date(application.createdAt) < new Date(legacy.createdAt)
        ? Number(application.spanDays) || 1
        : 0;

    // Debits are -1 and give-backs +1, so what is still taken = legacy days - ledger net.
    const outstanding = legacyDays - Number(ledgerNet);
    if (outstanding <= 0) {
      this.logger.log(`Leave ${leaveApplicationId} holds no debit — nothing to give back`);
      return false;
    }

    await this.post(
      {
        userId: application.userId,
        leaveCategory: application.leaveCategory,
        financialYear,
        entryType: LeaveLedgerEntryType.LEAVE_REVERSAL,
        days: 1,
        leaveApplicationId,
        reason: LEAVE_LEDGER_REASONS.LEAVE_REVERSAL.replace('{date}', day).replace(
          '{cause}',
          cause,
        ),
        createdBy,
      },
      entityManager,
    );
    return true;
  }

  async creditHolidayWork(
    params: {
      userId: string;
      leaveCategory: string;
      financialYear: string;
      days: number;
      holidayDates: string;
      periodMonth: string;
      createdBy: string;
    },
    entityManager?: EntityManager,
  ): Promise<void> {
    await this.inTransaction(entityManager, (em) =>
      this.post(
        {
          userId: params.userId,
          leaveCategory: params.leaveCategory,
          financialYear: params.financialYear,
          entryType: LeaveLedgerEntryType.HOLIDAY_WORK_CREDIT,
          days: params.days,
          periodMonth: params.periodMonth,
          reason: LEAVE_LEDGER_REASONS.HOLIDAY_WORK.replace('{dates}', params.holidayDates),
          createdBy: params.createdBy,
        },
        em,
      ),
    );
  }

  isAllocation(entryType: LeaveLedgerEntryType): boolean {
    return ALLOCATION_ENTRY_TYPES.includes(entryType);
  }

  async getLeaveConfigSettingId(financialYear: string): Promise<string | null> {
    const config = await this.configurationService.findOne({
      where: {
        module: CONFIGURATION_MODULES.LEAVE,
        key: CONFIGURATION_KEYS.LEAVE_CATEGORIES_CONFIG,
      },
    });
    if (!config) return null;

    const setting =
      (await this.configSettingService.findOne({
        where: { configId: config.id, contextKey: financialYear, isActive: true },
      })) ??
      (await this.configSettingService.findOne({
        where: { configId: config.id, contextKey: financialYear },
      }));
    return setting?.id ?? null;
  }

  /** "2026-05-10" → "2026-2027" (FY starts in April). */
  financialYearOf(isoDate: string): string {
    const [year, month] = isoDate.split('-').map(Number);
    const start = month >= 4 ? year : year - 1;
    return `${start}-${start + 1}`;
  }

  round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
