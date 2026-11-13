import { DataSource, EntityManager } from 'typeorm';

/**
 * GST / TDS register status attached to invoices and POs, so their summaries show what happened
 * to the tax after the invoice was paid — without anyone having to open the GST / TDS registers.
 *
 * None of this touches `paidTotal` / `bookedTotal`: those are the cash rollups the payment
 * ceilings are built on. Tax settlement is reported next to them, never folded into them.
 */

export type GstSettlementStatus = 'NOT_HELD' | 'PENDING' | 'IN_PROCESS' | 'SETTLED';

export interface InvoiceGstStatus {
  entryId: string;
  gstAmount: number;
  isGstHold: boolean;
  /** Matched on the GST portal (GSTR-2B purchase / GSTR-1 sale). */
  isVerified: boolean;
  /**
   * NOT_HELD: moved with the invoice payment. Held GST: PENDING → IN_PROCESS (GST release
   * booked, bank transfer not done — purchase only) → SETTLED (bank transfer done, or a legacy
   * direct record).
   */
  settlementStatus: GstSettlementStatus;
  settledAmount: number;
  settledAt: string | null;
}

export interface InvoiceTdsStatus {
  tdsAmount: number;
  /** PURCHASE: amount in deposited challans. SALE: always 0 (the client deposits). */
  depositedAmount: number;
  /** PURCHASE: filed in 26Q. SALE: credited in Form 26AS. */
  verifiedAmount: number;
  isDeposited: boolean;
  isVerified: boolean;
  lastDepositedAt: string | null;
}

export interface InvoiceTaxStatus {
  gstStatus: InvoiceGstStatus | null;
  tdsStatus: InvoiceTdsStatus | null;
}

export interface PoTaxTotals {
  gstHeldTotal: number;
  gstSettledTotal: number;
  tdsTotal: number;
  /** PURCHASE: challan-deposited. SALE: 26AS-verified. */
  tdsClearedTotal: number;
}

type Runner = DataSource | EntityManager;

const toIsoDate = (value: unknown): string | null => {
  if (!value) return null;
  // Already a calendar date ('YYYY-MM-DD' from TO_CHAR) — use it as is, no timezone involved.
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

export async function loadInvoiceTaxStatus(
  runner: Runner,
  invoiceIds: string[],
): Promise<Map<string, InvoiceTaxStatus>> {
  const result = new Map<string, InvoiceTaxStatus>();
  if (invoiceIds.length === 0) return result;
  for (const id of invoiceIds) result.set(id, { gstStatus: null, tdsStatus: null });

  const [gstRows, tdsRows] = await Promise.all([
    runner.query(
      `
        SELECT g."invoiceId", g."id", g."gstAmount", g."isGstHold", g."isVerified",
               g."gstPaymentId", g."gstBookPaymentId", g."gstBankTransferId",
               -- Read the DATE as text: the driver turns a DATE into midnight in the server's
               -- timezone, and converting that to an ISO string shifts it a day back east of UTC.
               TO_CHAR(COALESCE(bt."transferDate", gp."paymentDate"), 'YYYY-MM-DD') AS "paymentDate"
        FROM gst_register_entries g
        LEFT JOIN gst_payments gp ON gp."id" = g."gstPaymentId"
        LEFT JOIN bank_transfers bt ON bt."id" = g."gstBankTransferId" AND bt."deletedAt" IS NULL
        WHERE g."invoiceId" = ANY($1::uuid[]) AND g."deletedAt" IS NULL
      `,
      [invoiceIds],
    ),
    runner.query(
      `
        SELECT t."invoiceId", t."partyType",
               SUM(t."tdsAmount")                                                AS "tdsAmount",
               COALESCE(SUM(t."tdsAmount") FILTER (WHERE t."tdsPaymentId" IS NOT NULL), 0) AS "depositedAmount",
               COALESCE(SUM(t."tdsAmount") FILTER (WHERE t."isVerified" = true), 0)        AS "verifiedAmount",
               BOOL_AND(t."tdsPaymentId" IS NOT NULL)                            AS "isDeposited",
               BOOL_AND(t."isVerified")                                          AS "isVerified",
               TO_CHAR(MAX(tp."paymentDate"), 'YYYY-MM-DD')                      AS "lastDepositedAt"
        FROM tds_register_entries t
        LEFT JOIN tds_payments tp ON tp."id" = t."tdsPaymentId"
        WHERE t."invoiceId" = ANY($1::uuid[]) AND t."deletedAt" IS NULL
        GROUP BY t."invoiceId", t."partyType"
      `,
      [invoiceIds],
    ),
  ]);

  for (const r of gstRows) {
    const entry = result.get(r.invoiceId);
    if (!entry) continue;
    const isGstHold = Boolean(r.isGstHold);
    const isSettled = Boolean(r.gstPaymentId || r.gstBankTransferId);
    const isInProcess = !isSettled && Boolean(r.gstBookPaymentId);
    entry.gstStatus = {
      entryId: r.id,
      gstAmount: Number(r.gstAmount),
      isGstHold,
      isVerified: Boolean(r.isVerified),
      settlementStatus: !isGstHold
        ? 'NOT_HELD'
        : isSettled
        ? 'SETTLED'
        : isInProcess
        ? 'IN_PROCESS'
        : 'PENDING',
      settledAmount: isGstHold && isSettled ? Number(r.gstAmount) : 0,
      settledAt: isGstHold && isSettled ? toIsoDate(r.paymentDate) : null,
    };
  }

  for (const r of tdsRows) {
    const entry = result.get(r.invoiceId);
    if (!entry) continue;
    const isPurchase = r.partyType === 'PURCHASE';
    entry.tdsStatus = {
      tdsAmount: Number(r.tdsAmount),
      depositedAmount: isPurchase ? Number(r.depositedAmount) : 0,
      verifiedAmount: Number(r.verifiedAmount),
      isDeposited: isPurchase ? Boolean(r.isDeposited) : false,
      isVerified: Boolean(r.isVerified),
      lastDepositedAt: isPurchase ? toIsoDate(r.lastDepositedAt) : null,
    };
  }

  return result;
}

export async function loadPoTaxTotals(
  runner: Runner,
  poIds: string[],
): Promise<Map<string, PoTaxTotals>> {
  const result = new Map<string, PoTaxTotals>();
  if (poIds.length === 0) return result;
  for (const id of poIds) {
    result.set(id, { gstHeldTotal: 0, gstSettledTotal: 0, tdsTotal: 0, tdsClearedTotal: 0 });
  }

  const [gstRows, tdsRows] = await Promise.all([
    runner.query(
      `
        SELECT inv."poId",
               COALESCE(SUM(g."gstAmount") FILTER (WHERE g."isGstHold" = true), 0) AS "gstHeldTotal",
               COALESCE(SUM(g."gstAmount") FILTER (
                 WHERE g."isGstHold" = true AND (g."gstPaymentId" IS NOT NULL OR g."gstBankTransferId" IS NOT NULL)), 0)    AS "gstSettledTotal"
        FROM gst_register_entries g
        JOIN site_invoices inv ON inv."id" = g."invoiceId"
        WHERE inv."poId" = ANY($1::uuid[]) AND g."deletedAt" IS NULL
        GROUP BY inv."poId"
      `,
      [poIds],
    ),
    runner.query(
      `
        SELECT inv."poId",
               COALESCE(SUM(t."tdsAmount"), 0) AS "tdsTotal",
               COALESCE(SUM(t."tdsAmount") FILTER (
                 WHERE (t."partyType" = 'PURCHASE' AND t."tdsPaymentId" IS NOT NULL)
                    OR (t."partyType" = 'SALE' AND t."isVerified" = true)), 0)       AS "tdsClearedTotal"
        FROM tds_register_entries t
        JOIN site_invoices inv ON inv."id" = t."invoiceId"
        WHERE inv."poId" = ANY($1::uuid[]) AND t."deletedAt" IS NULL
        GROUP BY inv."poId"
      `,
      [poIds],
    ),
  ]);

  for (const r of gstRows) {
    const totals = result.get(r.poId);
    if (!totals) continue;
    totals.gstHeldTotal = Number(r.gstHeldTotal);
    totals.gstSettledTotal = Number(r.gstSettledTotal);
  }
  for (const r of tdsRows) {
    const totals = result.get(r.poId);
    if (!totals) continue;
    totals.tdsTotal = Number(r.tdsTotal);
    totals.tdsClearedTotal = Number(r.tdsClearedTotal);
  }

  return result;
}
