import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CommunicationCategory as C } from '../common/communication-logs/constants/communication-log.constants';
import { DocumentAction, NotificationEvents } from './notification.events';
import { NotificationService } from './notification.service';
import { NotificationRecipientsService } from './recipients.service';

export type DocumentKind = 'PO' | 'JMC' | 'REPORT' | 'INVOICE' | 'ADVANCE' | 'PAYMENT_REQUEST';

interface DocumentConfig {
  label: string;
  table: string;
  /** SQL for the document's number, over `d` (the document) and `x` (the extra join, if any). */
  numberSql: string;
  /** An extra LEFT JOIN aliased `x`, when the number lives on another table. */
  extraJoin?: string;
  approvePermission: string;
  /** Absent for documents with no lock / unlock flow. */
  unlockPermission?: string;
  category: string;
  referenceType: string;
  route: string;
  /** Approved the moment it is created, so "added" is not a request to approve. */
  createdApproved?: boolean;
}

/** Table and column names are fixed here, never taken from input — they go into SQL as text. */
const DOCUMENTS: Record<DocumentKind, DocumentConfig> = {
  PO: {
    label: 'PO',
    table: 'purchase_orders',
    numberSql: 'd."poNumber"',
    approvePermission: 'financials.purchase-orders.approve',
    unlockPermission: 'financials.purchase-orders.unlock',
    category: C.PURCHASE_ORDER,
    referenceType: 'purchase_order',
    route: '/purchase-orders',
  },
  JMC: {
    label: 'JMC',
    table: 'jmcs',
    numberSql: 'd."jmcNumber"',
    approvePermission: 'financials.jmcs.approve',
    unlockPermission: 'financials.jmcs.unlock',
    category: C.JMC,
    referenceType: 'jmc',
    route: '/jmcs',
  },
  REPORT: {
    label: 'Report',
    table: 'site_reports',
    numberSql: 'd."reportNumber"',
    approvePermission: 'financials.site-reports.approve',
    unlockPermission: 'financials.site-reports.unlock',
    category: C.SITE_REPORT,
    referenceType: 'site_report',
    route: '/site-reports',
    createdApproved: true,
  },
  INVOICE: {
    label: 'Invoice',
    table: 'site_invoices',
    numberSql: 'd."invoiceNumber"',
    approvePermission: 'financials.invoices.approve',
    unlockPermission: 'financials.invoices.unlock',
    category: C.SITE_INVOICE,
    referenceType: 'site_invoice',
    route: '/site-invoices',
  },
  ADVANCE: {
    label: 'Advance payment',
    table: 'advance_payments',
    numberSql: 'd."advanceNumber"',
    approvePermission: 'financials.advance-payments.approve',
    category: C.ADVANCE_PAYMENT,
    referenceType: 'advance_payment',
    route: '/advance-payments',
  },
  // A payment request has no number of its own; it is named after the invoice it is against.
  PAYMENT_REQUEST: {
    label: 'Payment request',
    table: 'payment_requests',
    numberSql:
      'CASE WHEN x."invoiceNumber" IS NOT NULL THEN \'for invoice \' || x."invoiceNumber" END',
    extraJoin: 'LEFT JOIN site_invoices x ON x."id" = d."invoiceId"',
    approvePermission: 'financials.payment-requests.approve',
    category: C.PAYMENT_REQUEST,
    referenceType: 'payment_request',
    route: '/payment-requests',
  },
};

/** What a notification needs to know about the document, read before the action changes it. */
export interface DocumentSnapshot {
  id: string;
  number: string | null;
  siteName: string | null;
  createdBy: string | null;
  unlockRequestedBy: string | null;
}

/**
 * Notifications for the approval documents (notification requirements v7, sections 10 and 13).
 *
 * Who hears about each action:
 *   added                       → everyone who can approve
 *   edited / deleted            → everyone who can approve, and the creator
 *   approved / rejected         → the creator
 *   unlock requested            → everyone who can grant unlocks
 *   unlock granted / rejected   → whoever asked for the unlock
 * and never the person who did the action.
 *
 * Callers take a `snapshot()` before an action that changes or removes what is needed (grant /
 * reject unlock clear the requester; delete hides the row), then `notify()` once it has succeeded.
 * Both never throw: the action has already happened by the time the notification goes out.
 */
@Injectable()
export class DocumentNotifierService {
  private readonly logger = new Logger(DocumentNotifierService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly notifications: NotificationService,
    private readonly recipients: NotificationRecipientsService,
  ) {}

  async snapshot(kind: DocumentKind, id: string): Promise<DocumentSnapshot | null> {
    const cfg = DOCUMENTS[kind];
    try {
      // Soft-deleted rows included, so a snapshot taken after a delete still works.
      const [row] = await this.dataSource.query(
        `SELECT d."id", ${cfg.numberSql} AS "number", s."name" AS "siteName", d."createdBy",
                ${cfg.unlockPermission ? 'd."unlockRequestedBy"' : 'NULL'} AS "unlockRequestedBy"
           FROM ${cfg.table} d
           LEFT JOIN sites s ON s."id" = d."siteId"
           ${cfg.extraJoin ?? ''}
          WHERE d."id" = $1`,
        [id],
      );
      return row ?? null;
    } catch (error) {
      this.logger.warn(`${kind} ${id} snapshot failed: ${error?.message ?? error}`);
      return null;
    }
  }

  /**
   * Fire-and-forget. `doc` is a snapshot, or an id to read now (fine when the action leaves the
   * needed fields in place — create, edit, approve, reject, request unlock).
   */
  notify(
    kind: DocumentKind,
    action: DocumentAction,
    doc: DocumentSnapshot | string | null | undefined,
    actorId: string,
    reason?: string | null,
  ): void {
    void this.send(kind, action, doc, actorId, reason).catch((error) =>
      this.logger.warn(`${kind} ${action} notification failed: ${error?.message ?? error}`),
    );
  }

  private async send(
    kind: DocumentKind,
    action: DocumentAction,
    doc: DocumentSnapshot | string | null | undefined,
    actorId: string,
    reason?: string | null,
  ): Promise<void> {
    const cfg = DOCUMENTS[kind];
    const snap = typeof doc === 'string' ? await this.snapshot(kind, doc) : doc;
    if (!snap) return;

    const userIds = (await this.recipientsFor(cfg, action, snap)).filter((id) => id !== actorId);
    if (!userIds.length) return;

    const [actor] = await this.dataSource.query(
      `SELECT "firstName", "lastName" FROM users WHERE "id" = $1`,
      [actorId],
    );
    const byName = actor ? `${actor.firstName} ${actor.lastName ?? ''}`.trim() : 'System';

    await this.notifications.notify({
      userIds,
      createdBy: actorId,
      email: true,
      ...NotificationEvents.documentEvent({
        action,
        label: cfg.label,
        number: snap.number,
        siteName: snap.siteName,
        byName,
        reason,
        category: cfg.category,
        referenceType: cfg.referenceType,
        referenceId: snap.id,
        awaitsApproval: !cfg.createdApproved,
        // A deleted document has no page to open; the list is the useful place.
        route: action === 'DELETED' ? cfg.route : `${cfg.route}/${snap.id}`,
      }),
    });
  }

  private async recipientsFor(
    cfg: DocumentConfig,
    action: DocumentAction,
    snap: DocumentSnapshot,
  ): Promise<string[]> {
    switch (action) {
      case 'ADDED':
        return this.recipients.usersWithPermission(cfg.approvePermission);
      case 'EDITED':
      case 'DELETED':
        return [
          ...(await this.recipients.usersWithPermission(cfg.approvePermission)),
          ...(snap.createdBy ? [snap.createdBy] : []),
        ];
      case 'APPROVED':
      case 'REJECTED':
        return snap.createdBy ? [snap.createdBy] : [];
      case 'UNLOCK_REQUESTED':
        return cfg.unlockPermission
          ? this.recipients.usersWithPermission(cfg.unlockPermission)
          : [];
      case 'UNLOCK_GRANTED':
      case 'UNLOCK_REJECTED':
        return snap.unlockRequestedBy ? [snap.unlockRequestedBy] : [];
    }
  }
}
