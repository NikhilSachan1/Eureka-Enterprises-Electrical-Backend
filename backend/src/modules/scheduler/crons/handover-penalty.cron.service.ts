import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { CRON_NAMES, CRON_SCHEDULES } from '../constants/scheduler.constants';
import { CronLogService } from '../../cron-logs/cron-log.service';
import { CronJobType } from '../../cron-logs/constants/cron-log.constants';
import { ConfigurationService } from '../../configurations/configuration.service';
import { ConfigSettingService } from '../../config-settings/config-setting.service';
import {
  CONFIGURATION_KEYS,
  CONFIGURATION_MODULES,
} from '../../../utils/master-constants/master-constants';
import { ExpenseTrackerService } from '../../expense-tracker/expense-tracker.service';
import {
  ExpenseEntryType,
  TransactionType,
} from '../../expense-tracker/constants/expense-tracker.constants';
import { WhatsAppService } from '../../common/whatsapp/whatsapp.service';
import { AssetEventEntity } from '../../asset-events/entities/asset-event.entity';
import { AssetFileEntity } from '../../asset-files/entities/asset-file.entity';
import { AssetVersionEntity } from '../../asset-versions/entities/asset-versions.entity';
import { VehicleEventEntity } from '../../vehicle-events/entities/vehicle-event.entity';
import { VehicleFileEntity } from '../../vehicle-files/entities/vehicle-file.entity';
import { VehicleVersionEntity } from '../../vehicle-versions/entities/vehicle-versions.entity';
import {
  AssetEventTypes,
  AssetStatus,
} from '../../asset-masters/constants/asset-masters.constants';
import {
  VehicleEventTypes,
  VehicleStatus,
} from '../../vehicle-masters/constants/vehicle-masters.constants';
import {
  HANDOVER_PENALTY_CATEGORY,
  HANDOVER_PENALTY_DEFAULTS,
  HANDOVER_PENALTY_REFERENCE_TYPES,
  HandoverPenaltyConfig,
  buildHandoverPenaltyDescription,
} from '../constants/handover-penalty.constants';
import {
  getLatestEventForUpdateQuery,
  getStaleAssetHandoversQuery,
  getStaleVehicleHandoversQuery,
  isArchived,
} from '../queries/handover-penalty.queries';
import {
  HandoverPenaltyModuleResult,
  HandoverPenaltyResult,
  StaleHandoverRow,
  emptyModuleResult,
} from '../types/handover-penalty.types';

/**
 * Everything that differs between the asset and the vehicle flow. The logic below is written once
 * against this shape, because the two flows are the same story with different table names.
 */
interface ModuleSpec {
  key: 'asset' | 'vehicle';
  eventsTable: string;
  itemIdColumn: string;
  referenceType: string;
  select: (hours: number) => { query: string; params: unknown[] };
  createEvent: (
    em: EntityManager,
    row: StaleHandoverRow,
  ) => Promise<{ id: string; metadata: Record<string, any> }>;
  copyFiles: (em: EntityManager, row: StaleHandoverRow, newEventId: string) => Promise<number>;
  assign: (em: EntityManager, row: StaleHandoverRow) => Promise<void>;
  stampExpenseOnEvent: (
    em: EntityManager,
    eventId: string,
    metadata: Record<string, any>,
  ) => Promise<void>;
}

@Injectable()
export class HandoverPenaltyCronService {
  private readonly logger = new Logger(HandoverPenaltyCronService.name);

  constructor(
    private readonly cronLogService: CronLogService,
    private readonly configurationService: ConfigurationService,
    private readonly configSettingService: ConfigSettingService,
    private readonly expenseTrackerService: ExpenseTrackerService,
    private readonly whatsAppService: WhatsAppService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
   * CRON: Handover Auto Penalty & Reassignment
   *
   * A handover that is neither accepted, rejected nor cancelled within the configured window
   * (default 48 hours) penalises its receiver and is assigned to them anyway, carrying the
   * initiation's images forward.
   *
   * Runs twice a day, 10:00 AM and 6:00 PM IST. Once a day would leave a window that closes just
   * after the run waiting almost a full day; twice bounds that to ~16 hours, and keeps both runs in
   * working hours since each one may message the employee. The `hours` window itself is exact — the
   * schedule only decides how soon after it closes the penalty is noticed.
   *
   * The whole feature is behind one config row and ships disabled — see `handover_auto_penalty`.
   */
  @Cron(CRON_SCHEDULES.TWICE_DAILY_10AM_6PM_IST)
  async handleHandoverAutoPenalty(): Promise<HandoverPenaltyResult | null> {
    const cronName = CRON_NAMES.HANDOVER_AUTO_PENALTY;

    return this.cronLogService.execute(cronName, CronJobType.ASSET, async () => {
      const config = await this.getConfig();

      const result: HandoverPenaltyResult = {
        enabled: config.enabled,
        hours: config.hours,
        amount: config.amount,
        asset: emptyModuleResult(),
        vehicle: emptyModuleResult(),
      };

      // The kill switch. Nothing is read or written while it is off.
      if (!config.enabled) {
        this.logger.log(`[${cronName}] Disabled by config — nothing scanned.`);
        return result;
      }

      for (const spec of this.moduleSpecs()) {
        if (!config.modules[spec.key]) {
          this.logger.log(`[${cronName}] ${spec.key} module disabled by config — skipped.`);
          continue;
        }
        result[spec.key] = await this.processModule(spec, config, cronName);
      }

      return result;
    });
  }

  // ─────────────────────────────── config ───────────────────────────────

  /**
   * Missing, malformed or unparseable config means *off*. A penalty charged because a config row
   * was absent would be worse than one never charged.
   */
  private async getConfig(): Promise<HandoverPenaltyConfig> {
    const fallback = HANDOVER_PENALTY_DEFAULTS as HandoverPenaltyConfig;
    try {
      const configuration = await this.configurationService.findOne({
        where: {
          module: CONFIGURATION_MODULES.ASSET,
          key: CONFIGURATION_KEYS.HANDOVER_AUTO_PENALTY,
        },
      });
      if (!configuration) return fallback;

      const setting = await this.configSettingService.findOne({
        where: { configId: configuration.id, isActive: true },
      });
      const value = setting?.value as Partial<HandoverPenaltyConfig> | undefined;
      if (!value) return fallback;

      const hours = Number(value.hours);
      const amount = Number(value.amount);

      return {
        enabled: value.enabled === true,
        hours: Number.isFinite(hours) && hours > 0 ? hours : fallback.hours,
        amount: Number.isFinite(amount) && amount > 0 ? amount : fallback.amount,
        modules: {
          asset: value.modules?.asset !== false,
          vehicle: value.modules?.vehicle !== false,
        },
      };
    } catch (error) {
      this.logger.warn(
        `[${CRON_NAMES.HANDOVER_AUTO_PENALTY}] Config unreadable, staying disabled: ${
          (error as Error).message
        }`,
      );
      return fallback;
    }
  }

  // ─────────────────────────────── processing ───────────────────────────────

  private async processModule(
    spec: ModuleSpec,
    config: HandoverPenaltyConfig,
    cronName: string,
  ): Promise<HandoverPenaltyModuleResult> {
    const result = emptyModuleResult();
    const { query, params } = spec.select(config.hours);
    const rows: StaleHandoverRow[] = await this.dataSource.query(query, params);
    result.scanned = rows.length;

    if (rows.length === 0) {
      this.logger.log(`[${cronName}] No ${spec.key} handovers past ${config.hours}h.`);
      return result;
    }

    for (const row of rows) {
      try {
        const applied = await this.penaliseAndAssign(spec, row, config);
        if (applied) {
          result.penalised += 1;
          result.penaltyTotal += config.amount;
        } else {
          result.skipped += 1;
        }
      } catch (error) {
        // One bad row must not stop the rest — its own transaction has already rolled back.
        const message = `${spec.key} ${row.itemId}: ${(error as Error).message}`;
        this.logger.error(`[${cronName}] ${message}`);
        result.errors.push(message);
      }
    }

    return result;
  }

  /**
   * One handover, one transaction: event, images, assignment and penalty all land together or not
   * at all. Returns false when another run got there first.
   */
  private async penaliseAndAssign(
    spec: ModuleSpec,
    row: StaleHandoverRow,
    config: HandoverPenaltyConfig,
  ): Promise<boolean> {
    const notify = await this.dataSource.transaction(async (em) => {
      // Re-check under a lock: two overlapping runs can both have selected this row.
      const [latest] = await em.query(
        getLatestEventForUpdateQuery(spec.eventsTable, spec.itemIdColumn),
        [row.itemId],
      );
      if (!latest || latest.eventType !== AssetEventTypes.HANDOVER_INITIATED) {
        this.logger.log(
          `[${CRON_NAMES.HANDOVER_AUTO_PENALTY}] ${spec.key} ${row.itemId} already acted on — skipped.`,
        );
        return null;
      }

      const event = await spec.createEvent(em, row);
      const copiedFiles = await spec.copyFiles(em, row, event.id);
      await spec.assign(em, row);

      const description = buildHandoverPenaltyDescription({
        amount: config.amount,
        hours: config.hours,
        itemLabel: row.itemLabel,
        identifier: row.itemIdentifier,
        employeeArchived: isArchived(row.receiverStatus),
      });

      const expense = await this.expenseTrackerService.createSystemExpense({
        userId: row.receiverId,
        category: HANDOVER_PENALTY_CATEGORY,
        amount: config.amount,
        description,
        createdBy: row.initiatorId ?? row.receiverId,
        referenceId: event.id,
        referenceType: spec.referenceType,
        // A penalty reduces what the company owes the employee, which in this ledger is a CREDIT;
        // the PENALTY tag is what stops the UI reading it as money paid out.
        transactionType: TransactionType.CREDIT,
        expenseEntryType: ExpenseEntryType.PENALTY,
        entityManager: em,
      });

      await spec.stampExpenseOnEvent(em, event.id, {
        ...event.metadata,
        penaltyExpenseId: expense.id,
        carriedForwardFiles: copiedFiles,
      });

      return { expenseId: expense.id };
    });

    if (!notify) return false;

    await this.notifyReceiver(row, config.amount);
    return true;
  }

  /** Non-blocking: a failed message must not undo a committed penalty. */
  private async notifyReceiver(row: StaleHandoverRow, amount: number): Promise<void> {
    try {
      if (!row.receiverWhatsappOptIn || !row.receiverPhone) return;
      await this.whatsAppService.sendExpenseForceCreated(
        row.receiverPhone,
        {
          employeeName: `${row.receiverFirstName ?? ''} ${row.receiverLastName ?? ''}`.trim(),
          amount: `₹${amount.toLocaleString('en-IN')}`,
          category: HANDOVER_PENALTY_CATEGORY,
          createdByName: 'System',
        },
        { referenceId: row.eventId, recipientId: row.receiverId },
      );
    } catch (error) {
      this.logger.error(
        `[${CRON_NAMES.HANDOVER_AUTO_PENALTY}] Penalty notification failed for ${row.receiverId}: ${
          (error as Error).message
        }`,
      );
    }
  }

  // ─────────────────────────────── module specs ───────────────────────────────

  private moduleSpecs(): ModuleSpec[] {
    return [this.assetSpec(), this.vehicleSpec()];
  }

  private assetSpec(): ModuleSpec {
    return {
      key: 'asset',
      eventsTable: 'assets_events',
      itemIdColumn: 'assetMasterId',
      referenceType: HANDOVER_PENALTY_REFERENCE_TYPES.ASSET,
      select: getStaleAssetHandoversQuery,
      createEvent: async (em, row) => {
        const metadata = this.baseMetadata(row);
        const event = await em.getRepository(AssetEventEntity).save({
          assetMasterId: row.itemId,
          eventType: AssetEventTypes.HANDOVER_AUTO_ACCEPTED,
          fromUser: row.initiatorId ?? undefined,
          toUser: row.receiverId,
          metadata,
          createdBy: row.initiatorId ?? row.receiverId,
        });
        return { id: event.id, metadata };
      },
      copyFiles: async (em, row, newEventId) => {
        // The images already exist in storage — only the rows are duplicated onto the new event,
        // so nothing has to be re-uploaded and the initiation keeps its own copies.
        const files = await em.getRepository(AssetFileEntity).find({
          where: { assetEventsId: row.eventId },
        });
        if (files.length === 0) return 0;
        await em.getRepository(AssetFileEntity).save(
          files.map((file) => ({
            assetMasterId: file.assetMasterId,
            assetVersionId: file.assetVersionId,
            fileType: file.fileType,
            fileKey: file.fileKey,
            label: file.label,
            assetEventsId: newEventId,
            createdBy: file.createdBy,
          })),
        );
        return files.length;
      },
      assign: async (em, row) => {
        await em
          .getRepository(AssetVersionEntity)
          .update(
            { assetMasterId: row.itemId, isActive: true },
            { status: AssetStatus.ASSIGNED, assignedTo: row.receiverId },
          );
      },
      stampExpenseOnEvent: async (em, eventId, metadata) => {
        await em.getRepository(AssetEventEntity).update({ id: eventId }, { metadata });
      },
    };
  }

  private vehicleSpec(): ModuleSpec {
    return {
      key: 'vehicle',
      eventsTable: 'vehicles_events',
      itemIdColumn: 'vehicleMasterId',
      referenceType: HANDOVER_PENALTY_REFERENCE_TYPES.VEHICLE,
      select: getStaleVehicleHandoversQuery,
      createEvent: async (em, row) => {
        const metadata = this.baseMetadata(row);
        const event = await em.getRepository(VehicleEventEntity).save({
          vehicleMasterId: row.itemId,
          eventType: VehicleEventTypes.HANDOVER_AUTO_ACCEPTED,
          fromUser: row.initiatorId ?? undefined,
          toUser: row.receiverId,
          metadata,
          createdBy: row.initiatorId ?? row.receiverId,
        });
        return { id: event.id, metadata };
      },
      copyFiles: async (em, row, newEventId) => {
        const files = await em.getRepository(VehicleFileEntity).find({
          where: { vehicleEventsId: row.eventId },
        });
        if (files.length === 0) return 0;
        await em.getRepository(VehicleFileEntity).save(
          files.map((file) => ({
            vehicleMasterId: file.vehicleMasterId,
            vehicleVersionId: file.vehicleVersionId,
            fileType: file.fileType,
            fileKey: file.fileKey,
            label: file.label,
            vehicleEventsId: newEventId,
            createdBy: file.createdBy,
          })),
        );
        return files.length;
      },
      assign: async (em, row) => {
        await em
          .getRepository(VehicleVersionEntity)
          .update(
            { vehicleMasterId: row.itemId, isActive: true },
            { status: VehicleStatus.ASSIGNED, assignedTo: row.receiverId },
          );
      },
      stampExpenseOnEvent: async (em, eventId, metadata) => {
        await em.getRepository(VehicleEventEntity).update({ id: eventId }, { metadata });
      },
    };
  }

  private baseMetadata(row: StaleHandoverRow): Record<string, any> {
    return {
      autoAccepted: true,
      initiatedEventId: row.eventId,
      initiatedAt: row.initiatedAt,
      reason: 'No accept / reject / cancel action within the configured window',
    };
  }
}
