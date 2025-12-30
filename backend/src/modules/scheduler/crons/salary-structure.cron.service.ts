import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SchedulerService } from '../scheduler.service';
import { CRON_SCHEDULES, CRON_NAMES } from '../constants/scheduler.constants';
import {
  SalaryStructureActivationResult,
  PendingActivationStructure,
  ActiveStructureToDeactivate,
  CurrentActiveStructure,
  ActivationLogEntry,
} from '../types/salary-structure.types';
import {
  getPendingActivationStructuresQuery,
  getExpiredActiveStructuresQuery,
  getCurrentActiveStructureQuery,
  activateSalaryStructureQuery,
  deactivateSalaryStructureQuery,
} from '../queries/salary-structure.queries';

@Injectable()
export class SalaryStructureCronService {
  private readonly logger = new Logger(SalaryStructureCronService.name);

  constructor(
    private readonly schedulerService: SchedulerService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
   * CRON 18: Salary Structure Activation/Deactivation
   *
   * Runs daily at midnight IST to manage salary structure transitions.
   *
   * Scenarios Handled:
   * 1. ACTIVATION: Structures with effectiveFrom <= today that are inactive
   *    - Activates the pending structure
   *    - Deactivates/supersedes the current active structure for the user
   *    - Sets effectiveTo on the superseded structure
   *
   * 2. DEACTIVATION: Structures with effectiveTo < today that are still active
   *    - Deactivates expired structures
   *
   * 3. MULTIPLE PENDING: If user has multiple pending structures
   *    - Processes them in order of effectiveFrom (oldest first)
   *    - Each activation supersedes the previous
   *
   * Validations:
   * - Skips deleted salary structures (deletedAt IS NOT NULL)
   * - Skips structures for deleted users
   * - Ensures only ONE active structure per user at any time
   * - Logs all changes for audit trail
   *
   * Edge Cases:
   * - Structure with past effectiveFrom never activated - will be activated
   * - User with no active structure - new structure activates normally
   * - Same effectiveFrom date for multiple structures - processed by creation order
   */
  @Cron(CRON_SCHEDULES.DAILY_MIDNIGHT_IST)
  async handleSalaryStructureActivation(): Promise<SalaryStructureActivationResult> {
    const cronName = CRON_NAMES.SALARY_STRUCTURE_ACTIVATION;
    this.schedulerService.logCronStart(cronName);

    const result: SalaryStructureActivationResult = {
      structuresActivated: 0,
      structuresDeactivated: 0,
      previousStructuresUpdated: 0,
      usersAffected: [],
      errors: [],
    };

    const activationLog: ActivationLogEntry[] = [];

    try {
      // Deactivate expired structures first
      const deactivationResult = await this.deactivateExpiredStructures(cronName, activationLog);
      result.structuresDeactivated = deactivationResult.count;
      result.errors.push(...deactivationResult.errors);

      // Activate pending structures
      const activationResult = await this.activatePendingStructures(cronName, activationLog);
      result.structuresActivated = activationResult.activated;
      result.previousStructuresUpdated = activationResult.superseded;
      result.usersAffected = activationResult.usersAffected;
      result.errors.push(...activationResult.errors);

      // Log summary
      this.logActivationSummary(cronName, activationLog);

      this.schedulerService.logCronComplete(cronName, result);
      return result;
    } catch (error) {
      this.schedulerService.logCronError(cronName, error);
      result.errors.push(error.message);
      return result;
    }
  }

  private async deactivateExpiredStructures(
    cronName: string,
    activationLog: ActivationLogEntry[],
  ): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    try {
      const { query, params } = getExpiredActiveStructuresQuery();
      const expiredStructures: ActiveStructureToDeactivate[] = await this.dataSource.query(
        query,
        params,
      );

      if (expiredStructures.length === 0) {
        this.logger.log(`[${cronName}] No expired structures to deactivate`);
        return { count: 0, errors: [] };
      }

      this.logger.log(`[${cronName}] Found ${expiredStructures.length} expired structures`);

      for (const structure of expiredStructures) {
        try {
          const { query: deactivateQuery, params: deactivateParams } =
            deactivateSalaryStructureQuery(structure.id);
          await this.dataSource.query(deactivateQuery, deactivateParams);

          activationLog.push({
            structureId: structure.id,
            userId: structure.userId,
            employeeName: `${structure.firstName} ${structure.lastName}`,
            action: 'DEACTIVATED',
            effectiveFrom: structure.effectiveFrom,
            effectiveTo: structure.effectiveTo,
          });

          this.logger.debug(
            `[${cronName}] Deactivated expired structure ${structure.id} for ${structure.firstName} ${structure.lastName}`,
          );
          count++;
        } catch (error) {
          const errorMsg = `Failed to deactivate structure ${structure.id}: ${error.message}`;
          errors.push(errorMsg);
          this.logger.error(`[${cronName}] ${errorMsg}`);
        }
      }

      return { count, errors };
    } catch (error) {
      errors.push(`Deactivation query failed: ${error.message}`);
      return { count: 0, errors };
    }
  }

  private async activatePendingStructures(
    cronName: string,
    activationLog: ActivationLogEntry[],
  ): Promise<{ activated: number; superseded: number; usersAffected: string[]; errors: string[] }> {
    const errors: string[] = [];
    let activated = 0;
    let superseded = 0;
    const usersAffected: Set<string> = new Set();

    try {
      const { query, params } = getPendingActivationStructuresQuery();
      const pendingStructures: PendingActivationStructure[] = await this.dataSource.query(
        query,
        params,
      );

      if (pendingStructures.length === 0) {
        this.logger.log(`[${cronName}] No pending structures to activate`);
        return { activated: 0, superseded: 0, usersAffected: [], errors: [] };
      }

      this.logger.log(`[${cronName}] Found ${pendingStructures.length} pending structures`);

      // Group by user to handle multiple pending structures per user
      const structuresByUser = this.groupStructuresByUser(pendingStructures);

      for (const [userId, structures] of structuresByUser.entries()) {
        // Structures are already sorted by effectiveFrom ASC
        // Process each one, superseding the previous
        for (let i = 0; i < structures.length; i++) {
          const structure = structures[i];

          try {
            // Find current active structure for this user
            const { query: activeQuery, params: activeParams } =
              getCurrentActiveStructureQuery(userId);
            const [currentActive]: CurrentActiveStructure[] = await this.dataSource.query(
              activeQuery,
              activeParams,
            );

            // If there's a current active structure, supersede it
            if (currentActive && currentActive.id !== structure.id) {
              // Set effectiveTo to day before new structure's effectiveFrom
              const effectiveTo = new Date(structure.effectiveFrom);
              effectiveTo.setDate(effectiveTo.getDate() - 1);

              const { query: deactivateQuery, params: deactivateParams } =
                deactivateSalaryStructureQuery(currentActive.id, effectiveTo);
              await this.dataSource.query(deactivateQuery, deactivateParams);

              activationLog.push({
                structureId: currentActive.id,
                userId: currentActive.userId,
                employeeName: `${structure.firstName} ${structure.lastName}`,
                action: 'SUPERSEDED',
                effectiveFrom: currentActive.effectiveFrom,
                effectiveTo: effectiveTo,
              });

              this.logger.debug(
                `[${cronName}] Superseded structure ${currentActive.id} for ${structure.firstName} ${structure.lastName}`,
              );
              superseded++;
            }

            // Activate the pending structure
            const { query: activateQuery, params: activateParams } = activateSalaryStructureQuery(
              structure.id,
            );
            await this.dataSource.query(activateQuery, activateParams);

            activationLog.push({
              structureId: structure.id,
              userId: structure.userId,
              employeeName: `${structure.firstName} ${structure.lastName}`,
              action: 'ACTIVATED',
              effectiveFrom: structure.effectiveFrom,
              grossSalary: Number(structure.grossSalary),
              ctc: Number(structure.ctc),
            });

            this.logger.log(
              `[${cronName}] ✅ Activated structure ${structure.id} for ${structure.firstName} ${structure.lastName} ` +
                `(${structure.incrementType}, CTC: ₹${Number(structure.ctc).toLocaleString(
                  'en-IN',
                )})`,
            );

            activated++;
            usersAffected.add(userId);
          } catch (error) {
            const errorMsg = `Failed to activate structure ${structure.id} for ${structure.firstName} ${structure.lastName}: ${error.message}`;
            errors.push(errorMsg);
            this.logger.error(`[${cronName}] ${errorMsg}`);
          }
        }
      }

      return {
        activated,
        superseded,
        usersAffected: Array.from(usersAffected),
        errors,
      };
    } catch (error) {
      errors.push(`Activation query failed: ${error.message}`);
      return { activated: 0, superseded: 0, usersAffected: [], errors };
    }
  }

  private groupStructuresByUser(
    structures: PendingActivationStructure[],
  ): Map<string, PendingActivationStructure[]> {
    const grouped = new Map<string, PendingActivationStructure[]>();

    for (const structure of structures) {
      if (!grouped.has(structure.userId)) {
        grouped.set(structure.userId, []);
      }
      grouped.get(structure.userId)!.push(structure);
    }

    return grouped;
  }

  private logActivationSummary(cronName: string, activationLog: ActivationLogEntry[]): void {
    if (activationLog.length === 0) {
      this.logger.log(`[${cronName}] No salary structure changes today`);
      return;
    }

    const activated = activationLog.filter((log) => log.action === 'ACTIVATED').length;
    const deactivated = activationLog.filter((log) => log.action === 'DEACTIVATED').length;
    const superseded = activationLog.filter((log) => log.action === 'SUPERSEDED').length;

    this.logger.log(
      `[${cronName}] Summary: ${activated} activated, ${superseded} superseded, ${deactivated} deactivated`,
    );

    // Log details for each action
    for (const log of activationLog) {
      const emoji = log.action === 'ACTIVATED' ? '🟢' : log.action === 'SUPERSEDED' ? '🔄' : '🔴';
      this.logger.debug(
        `[${cronName}] ${emoji} ${log.action}: ${log.employeeName} (Structure: ${log.structureId})`,
      );
    }
  }
}
