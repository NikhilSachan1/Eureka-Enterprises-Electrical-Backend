import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  APPROVAL_QUEUES,
  approvalQueueCountsQuery,
  myApprovalPermissionsQuery,
  paymentSheetFlowQuery,
  paymentSheetStageCountsQuery,
} from './queries/approval-queue.queries';
import { DOCUMENT_GAPS, findGap } from './queries/document-gap.queries';

/** How many rows a gap's drill-down returns before the reader should go to the real screen. */
const GAP_LIST_LIMIT = 50;

/** Used when the payment-sheet chain cannot be read from config. */
const FALLBACK_FLOW = [
  { stage: 'INITIATION', role: 'OPERATION_MANAGER' },
  { stage: 'HR_REVIEW', role: 'HR' },
  { stage: 'ADMIN_REVIEW', role: 'ADMIN' },
  { stage: 'PROCESSING', role: 'ACCOUNTS' },
];

export interface ApprovalQueue {
  key: string;
  label: string;
  /** How many exist at all, within scope. */
  total: number;
  /** How many are waiting for approval, within scope. */
  pending: number;
  /** Of those, how many this reader's roles are the ones who clear them. */
  onMe: number;
  /** What the reader raised and is still waiting on — regardless of scope. */
  raisedByMe: number;
  /** Age of the longest-waiting one, in days. */
  oldestDays: number;
  /** Whether this reader can clear this queue at all. */
  iApprove: boolean;
}

export interface PaymentSheetStage {
  stage: string;
  /** Whose desk this stage is. */
  role: string | null;
  count: number;
  oldestDays: number;
  /** True when that desk is this reader's. */
  onMe: boolean;
}

/**
 * The work board: what is waiting on whom, and where the document chain has stopped.
 *
 * Scoped exactly like the rest of the dashboard — a null scope reads the company, a user id reads
 * one person — and it never takes a user id from the request, so there is nothing to tamper with.
 */
@Injectable()
export class WorkBoardService {
  private readonly logger = new Logger(WorkBoardService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private async rows<T>(sql: string, params: unknown[]): Promise<T[]> {
    try {
      return (await this.dataSource.query(sql, params)) as T[];
    } catch (error) {
      // Unlike the rest of this dashboard, a failure here is logged *and* surfaced: a work board
      // that quietly reports zero pending approvals is worse than one that admits it is broken.
      this.logger.error(`Work board query failed: ${(error as Error).message}`);
      throw error;
    }
  }

  /** The approval permissions this reader's roles carry. */
  private async myPermissions(userId: string): Promise<Set<string>> {
    const rows = await this.rows<{ name: string }>(myApprovalPermissionsQuery, [userId]);
    return new Set(rows.map((r) => r.name));
  }

  /** The configured payment-sheet chain, or the default one if config cannot be read. */
  private async approvalFlow(): Promise<Array<{ stage: string; role: string }>> {
    try {
      const [row] = await this.dataSource.query(paymentSheetFlowQuery, []);
      const value = typeof row?.value === 'string' ? JSON.parse(row.value) : row?.value;
      if (Array.isArray(value) && value.length) return value;
    } catch (error) {
      this.logger.warn(`Approval flow unreadable, using the default: ${(error as Error).message}`);
    }
    return FALLBACK_FLOW;
  }

  /**
   * Every approval queue, plus the payment-sheet chain.
   *
   * `onMe` is computed from the permission table rather than from a list in this file, so it
   * cannot drift from what the API will actually let the reader do. For the payment sheet the
   * same question is answered by the stage the sheet is sitting on: "OM ne process kar di, ab HR
   * ko dikhe" is exactly a sheet whose `currentStage` is the stage whose role is HR.
   */
  async getPendingApprovals(scopeUserId: string | null, meUserId: string) {
    const [counts, permissions, stageRows, flow] = await Promise.all([
      this.rows<any>(approvalQueueCountsQuery, [scopeUserId, meUserId]),
      this.myPermissions(meUserId),
      this.rows<any>(paymentSheetStageCountsQuery, [scopeUserId]),
      this.approvalFlow(),
    ]);

    const byKey = new Map(counts.map((c) => [c.key, c]));
    const queues: ApprovalQueue[] = APPROVAL_QUEUES.map((def) => {
      const row = byKey.get(def.key) ?? {};
      const iApprove = def.permission ? permissions.has(def.permission) : false;
      const pending = Number(row.pending ?? 0);
      return {
        key: def.key,
        label: def.label,
        total: Number(row.total ?? 0),
        pending,
        // The whole queue is on this reader when their role is the one that clears it; none of it
        // is otherwise. There is no partial ownership of an approval queue.
        onMe: iApprove ? pending : 0,
        raisedByMe: Number(row.raisedByMe ?? 0),
        oldestDays: Number(row.oldestDays ?? 0),
        iApprove,
      };
    });

    const roleOfStage = new Map(flow.map((s) => [s.stage, s.role]));
    const myRoles = await this.rolesOf(meUserId);
    const stages: PaymentSheetStage[] = flow.map((s) => {
      const matching = stageRows.filter((r) => r.stage === s.stage);
      return {
        stage: s.stage,
        role: s.role ?? null,
        count: matching.reduce((sum, r) => sum + Number(r.count ?? 0), 0),
        oldestDays: matching.reduce((max, r) => Math.max(max, Number(r.oldestDays ?? 0)), 0),
        onMe: Boolean(s.role && myRoles.has(s.role)),
      };
    });

    // A stage that config no longer lists can still hold sheets; dropping them would make work
    // vanish from the board, so they are reported with no desk against them.
    for (const r of stageRows) {
      if (!roleOfStage.has(r.stage)) {
        const existing = stages.find((s) => s.stage === r.stage);
        if (existing) existing.count += Number(r.count ?? 0);
        else
          stages.push({
            stage: r.stage,
            role: null,
            count: Number(r.count ?? 0),
            oldestDays: Number(r.oldestDays ?? 0),
            onMe: false,
          });
      }
    }

    const sheetsOnMe = stages.filter((s) => s.onMe).reduce((sum, s) => sum + s.count, 0);

    return {
      scope: scopeUserId === null ? 'all' : 'mine',
      totals: {
        pending:
          queues.reduce((sum, q) => sum + q.pending, 0) + stages.reduce((s, x) => s + x.count, 0),
        onMe: queues.reduce((sum, q) => sum + q.onMe, 0) + sheetsOnMe,
        raisedByMe: queues.reduce((sum, q) => sum + q.raisedByMe, 0),
      },
      queues,
      paymentSheets: {
        pending: stages.reduce((sum, s) => sum + s.count, 0),
        onMe: sheetsOnMe,
        byStage: stages,
      },
    };
  }

  /** The role names this reader holds, for matching against the payment-sheet chain. */
  private async rolesOf(userId: string): Promise<Set<string>> {
    const rows = await this.rows<{ name: string }>(
      `SELECT r."name"
         FROM user_roles ur
         JOIN roles r ON r."id" = ur."roleId" AND r."deletedAt" IS NULL
        WHERE ur."userId" = $1 AND ur."deletedAt" IS NULL`,
      [userId],
    );
    return new Set(rows.map((r) => r.name));
  }

  /**
   * Where the document chain has stopped.
   *
   * Problems and information are returned apart on purpose. Part-billing a PO is ordinary, and
   * mixing it in with "approved but never invoiced" would leave a list nobody reads.
   */
  async getDocumentGaps(scopeUserId: string | null) {
    const results = await Promise.all(
      DOCUMENT_GAPS.map(async (gap) => {
        const [row] = await this.rows<any>(gap.countSql, [scopeUserId]);
        return {
          key: gap.key,
          label: gap.label,
          hint: gap.hint,
          severity: gap.severity,
          count: Number(row?.count ?? 0),
          oldestDays: Number(row?.oldestDays ?? 0),
        };
      }),
    );

    const problems = results.filter((r) => r.severity === 'problem');
    return {
      scope: scopeUserId === null ? 'all' : 'mine',
      totals: {
        problems: problems.reduce((sum, r) => sum + r.count, 0),
        /** The longest anything has been stuck, which is what makes a count worth acting on. */
        oldestDays: problems.reduce((max, r) => Math.max(max, r.oldestDays), 0),
      },
      gaps: results.filter((r) => r.severity === 'problem'),
      info: results.filter((r) => r.severity === 'info'),
    };
  }

  /** The rows behind one gap, so a count can be acted on rather than just read. */
  async getDocumentGapList(key: string, scopeUserId: string | null) {
    const gap = findGap(key);
    if (!gap) {
      throw new NotFoundException(
        `Unknown document gap "${key}". Known: ${DOCUMENT_GAPS.map((g) => g.key).join(', ')}`,
      );
    }
    const items = await this.rows<any>(gap.listSql, [scopeUserId, GAP_LIST_LIMIT]);
    return {
      key: gap.key,
      label: gap.label,
      hint: gap.hint,
      severity: gap.severity,
      items,
      /** True when there are more than this page shows — go to the real screen for the rest. */
      truncated: items.length === GAP_LIST_LIMIT,
    };
  }
}
