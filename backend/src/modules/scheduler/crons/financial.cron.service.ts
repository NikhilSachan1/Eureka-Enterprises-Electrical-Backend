import { Injectable, Logger } from '@nestjs/common';
// import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CRON_NAMES } from '../constants/scheduler.constants';
import { CronLogService } from '../../cron-logs/cron-log.service';
import { CronJobType } from '../../cron-logs/constants/cron-log.constants';

interface RefreshResult {
  refreshedViews: string[];
  durationsMs: Record<string, number>;
  errors: { view: string; error: string }[];
}

/**
 * Refreshes the financial materialized views that back the dashboard
 * Universal View and the PO-wise summary.
 *
 * Plan §3.4 hardening #9 + §7.5 — refresh `mv_site_financial_summary` and
 * `mv_universal_financial_view` every 5 minutes so the dashboard reflects
 * recent invoice approvals, book payments, and bank transfers.
 *
 * Both views were created with unique indexes (idx_mv_site_financial_summary_po
 * and idx_mv_universal_financial_view_pk) so we can use REFRESH ...
 * CONCURRENTLY — readers are not blocked during the refresh.
 */
@Injectable()
export class FinancialCronService {
  private readonly logger = new Logger(FinancialCronService.name);

  private static readonly VIEWS = ['mv_site_financial_summary', 'mv_universal_financial_view'];

  constructor(
    private readonly cronLogService: CronLogService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // @Cron(CRON_SCHEDULES.EVERY_5_MINUTES)
  async refreshMaterializedViews(): Promise<RefreshResult | null> {
    const cronName = CRON_NAMES.REFRESH_FINANCIAL_MATERIALIZED_VIEWS;

    return this.cronLogService.execute(cronName, CronJobType.FINANCIAL, async () => {
      const result: RefreshResult = {
        refreshedViews: [],
        durationsMs: {},
        errors: [],
      };

      for (const view of FinancialCronService.VIEWS) {
        const startedAt = Date.now();
        try {
          await this.dataSource.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`);
          result.refreshedViews.push(view);
          result.durationsMs[view] = Date.now() - startedAt;
          this.logger.debug(`[${cronName}] Refreshed ${view} in ${result.durationsMs[view]}ms`);
        } catch (error) {
          // CONCURRENTLY can fail on the very first refresh (when the MV has
          // not been populated yet). Fall back to a non-concurrent refresh
          // once and continue with the next view either way.
          const message = error instanceof Error ? error.message : String(error);
          this.logger.warn(
            `[${cronName}] CONCURRENTLY refresh failed for ${view}: ${message}; ` +
              `falling back to non-concurrent refresh`,
          );
          try {
            await this.dataSource.query(`REFRESH MATERIALIZED VIEW ${view}`);
            result.refreshedViews.push(view);
            result.durationsMs[view] = Date.now() - startedAt;
          } catch (fallbackError) {
            const fallbackMsg =
              fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
            this.logger.error(`[${cronName}] Fallback refresh failed for ${view}: ${fallbackMsg}`);
            result.errors.push({ view, error: fallbackMsg });
          }
        }
      }

      this.logger.log(
        `[${cronName}] Refreshed ${result.refreshedViews.length}/${FinancialCronService.VIEWS.length} views`,
      );

      return result;
    });
  }
}
