import { ConflictException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { Environments } from '../../../env-configs';
import {
  DATA_SYNC_ERRORS,
  DATA_SYNC_LOCK_KEY,
  DATA_SYNC_RESPONSES,
  DATA_SYNC_SKIPPED_DATA_TABLES,
  DATA_SYNC_TARGET_DB_SUFFIX,
  DATA_SYNC_UNTOUCHED_TABLES,
} from './constants/data-sync.constants';
import {
  buildCreateFdwServerSql,
  buildCreateUserMappingSql,
  countKeptPermissionsSql,
  dropSyncObjectsSql,
  importMirrorSchemaSql,
  keepUatOnlyPermissionsSql,
  listSyncTablesSql,
  maskContactDetailsSql,
  resetOwnedSequencesSql,
  restoreUatOnlyPermissionsSql,
} from './queries/data-sync.queries';
import { DataSyncStatus, SyncTableRow } from './types/data-sync.types';

/**
 * Replaces UAT's data with prod's, in one transaction on the UAT database:
 *   1. prod's public schema is mounted read-only through postgres_fdw (same RDS instance);
 *   2. every UAT table except `migrations` is emptied — permissions that exist only on UAT
 *      (seeded by migrations prod has not run yet) are kept aside and put back afterwards;
 *   3. each table is refilled from prod — columns both sides share — except the log tables,
 *      which stay empty;
 *   4. emails / phone numbers are masked;
 *   5. the fdw objects are dropped, so no prod credentials stay behind.
 * Any failure rolls everything back and UAT is left as it was. Prod is only ever read.
 */
@Injectable()
export class DataSyncService {
  private readonly logger = new Logger(DataSyncService.name);

  constructor(private readonly dataSource: DataSource) {}

  async getStatus(): Promise<DataSyncStatus> {
    const [{ database }] = await this.dataSource.query('SELECT current_database() AS database');
    const sourceDatabase = Environments.DATA_SYNC_SOURCE_DATABASE ?? null;
    const reason = this.unavailableReason(database, sourceDatabase);
    return {
      available: reason === null,
      reason,
      sourceDatabase,
      targetDatabase: database,
      skippedTables: [...DATA_SYNC_SKIPPED_DATA_TABLES],
    };
  }

  async syncFromProd(userId: string) {
    const status = await this.getStatus();
    if (!status.available) throw new ForbiddenException(status.reason);

    const startedAt = Date.now();
    this.logger.log(`Prod → UAT sync started by ${userId}`);

    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const [{ locked }] = await runner.query('SELECT pg_try_advisory_xact_lock($1) AS locked', [
        DATA_SYNC_LOCK_KEY,
      ]);
      if (!locked) throw new ConflictException(DATA_SYNC_ERRORS.ALREADY_RUNNING);

      await runner.query('SET LOCAL statement_timeout = 0');
      await this.mountSource(runner, status.sourceDatabase as string);

      const tables: SyncTableRow[] = await runner.query(listSyncTablesSql, [
        [...DATA_SYNC_UNTOUCHED_TABLES],
      ]);
      for (const sql of keepUatOnlyPermissionsSql) await runner.query(sql);
      const [{ count: permissionsKept }] = await runner.query(countKeptPermissionsSql);
      await runner.query(`TRUNCATE TABLE ${tables.map((t) => t.targetTable).join(', ')} CASCADE`);

      // Rows arrive in table-name order, not dependency order: skip FK triggers while loading.
      await runner.query('SET LOCAL session_replication_role = replica');
      const skipped = new Set<string>(DATA_SYNC_SKIPPED_DATA_TABLES);
      const missingInSource: string[] = [];
      let tablesCopied = 0;
      let rowsCopied = 0;

      for (const table of tables) {
        if (skipped.has(table.tableName)) continue;
        if (!table.columns) {
          missingInSource.push(table.tableName);
          continue;
        }
        const [{ count }] = await runner.query(
          `WITH moved AS (
             INSERT INTO ${table.targetTable} (${table.columns}) OVERRIDING SYSTEM VALUE
             SELECT ${table.columns} FROM ${table.sourceTable}
             RETURNING 1
           ) SELECT count(*)::int AS count FROM moved`,
        );
        tablesCopied += 1;
        rowsCopied += count;
      }
      await runner.query('SET LOCAL session_replication_role = origin');

      for (const sql of restoreUatOnlyPermissionsSql) await runner.query(sql);
      await runner.query(resetOwnedSequencesSql);
      const offset = Math.floor(Math.random() * 900_000);
      for (const sql of maskContactDetailsSql) {
        await runner.query(sql, [offset]);
      }

      for (const sql of dropSyncObjectsSql) await runner.query(sql);
      await runner.commitTransaction();

      const result = {
        message: DATA_SYNC_RESPONSES.COMPLETED,
        sourceDatabase: status.sourceDatabase,
        targetDatabase: status.targetDatabase,
        tablesCopied,
        rowsCopied,
        skippedTables: [...DATA_SYNC_SKIPPED_DATA_TABLES],
        missingInSource,
        // Permissions from migrations that ran on UAT but not on prod yet, put back after the copy.
        permissionsKept,
        durationMs: Date.now() - startedAt,
        finishedAt: new Date().toISOString(),
      };
      this.logger.log(
        `Prod → UAT sync finished: ${tablesCopied} tables, ${rowsCopied} rows, ${result.durationMs} ms`,
      );
      return result;
    } catch (error) {
      await runner.rollbackTransaction();
      this.logger.error(`Prod → UAT sync failed and was rolled back: ${(error as Error).message}`);
      throw error;
    } finally {
      await runner.release();
    }
  }

  private async mountSource(runner: QueryRunner, sourceDatabase: string): Promise<void> {
    await runner.query('CREATE EXTENSION IF NOT EXISTS postgres_fdw');
    for (const sql of dropSyncObjectsSql) await runner.query(sql);

    // Prod sits on the same RDS instance with the same user. The host is the RDS endpoint as the
    // database itself sees it (locally the SSH tunnel only replaces the app's own connection).
    const [server] = await runner.query(buildCreateFdwServerSql, [
      Environments.DATABASE_HOST,
      String(Environments.DATABASE_PORT || 5432),
      sourceDatabase,
    ]);
    await runner.query(server.ddl);

    const [mapping] = await runner.query(buildCreateUserMappingSql, [
      Environments.DATABASE_USERNAME,
      Environments.DATABASE_PASSWORD,
    ]);
    await runner.query(mapping.ddl);

    for (const sql of importMirrorSchemaSql) await runner.query(sql);
  }

  private unavailableReason(database: string, sourceDatabase: string | null): string | null {
    if (!Environments.DATA_SYNC_ENABLED) return DATA_SYNC_ERRORS.DISABLED;
    if (!sourceDatabase) return DATA_SYNC_ERRORS.SOURCE_NOT_CONFIGURED;
    if (!database.endsWith(DATA_SYNC_TARGET_DB_SUFFIX)) {
      return DATA_SYNC_ERRORS.TARGET_NOT_UAT.replace('{database}', database);
    }
    if (database === sourceDatabase) return DATA_SYNC_ERRORS.SAME_DATABASE;
    return null;
  }
}
