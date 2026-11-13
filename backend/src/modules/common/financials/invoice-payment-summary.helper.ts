import { GstSettlementStatus, InvoiceTaxStatus } from './tax-register-status.helper';

/**
 * Where an invoice's money stands, worked out once on the server so every screen shows the same
 * figures.
 *
 * An invoice's value (taxable + GST) is cleared four ways, and together they add up to it:
 *   - the invoice payment, by bank transfer (`paid`)
 *   - advances adjusted against it (`advanceAdjusted`)
 *   - held GST, released to the vendor / received from the client on its own (`gst.settled`)
 *   - TDS, deposited by challan (purchase) / credited in 26AS (sale) (`tds.cleared`)
 * When GST is not held it moves with the invoice payment, so it is already inside `paid`.
 */

export type InvoiceTdsClearance = 'CLEARED' | 'DEPOSITED' | 'PENDING';

export interface InvoicePaymentSummary {
  /** Taxable + GST: everything this invoice is worth. */
  invoiceValue: number;
  /** What the invoice payment covers: taxable − TDS, plus GST when it is not held. */
  netPayable: number;
  /** Purchase only: booked for payment. Null on a sale invoice, which has no booking step. */
  booked: number | null;
  /** Bank transfers against the invoice payment. */
  paid: number;
  /** Purchase only: booked but the bank transfer not done yet. */
  awaitingTransfer: number | null;
  /** Purchase only: net payable not yet booked (after advances). */
  toBook: number | null;
  advanceAdjusted: number;
  /** Invoice payment still to pay / receive, after advances. */
  paymentBalance: number;
  /** Null when the invoice carries no GST. */
  gst: {
    amount: number;
    isHeld: boolean;
    /** NOT_HELD: moved with the invoice payment. */
    status: GstSettlementStatus;
    /** Held GST released / received. */
    settled: number;
    /** Held GST still to release / receive. */
    pending: number;
    settledAt: string | null;
  } | null;
  /** Null when the invoice carries no TDS. */
  tds: {
    amount: number;
    /** Purchase: deposited by challan. Sale: credited in Form 26AS. */
    cleared: number;
    pending: number;
    /**
     * Purchase: CLEARED = deposited and filed in 26Q, DEPOSITED = challan paid, not filed yet.
     * Sale: CLEARED = credited in 26AS. PENDING otherwise.
     */
    status: InvoiceTdsClearance;
  } | null;
  /** Paid + advances + held GST settled + TDS cleared. */
  totalSettled: number;
  /** Invoice value not cleared yet. */
  totalBalance: number;
  /** 0–100. */
  settledPercent: number;
}

interface InvoiceAmounts {
  partyType: string;
  taxableAmount: number | string | null;
  gstAmount: number | string | null;
  tdsAmount: number | string | null;
  isGstHold: boolean | null;
  bookedTotal: number | string | null;
  paidTotal: number | string | null;
  advanceSettledAmount: number | string | null;
}

const money = (value: number) => Math.round(value * 100) / 100;
const positive = (value: number) => Math.max(money(value), 0);
const num = (value: number | string | null | undefined) => Number(value ?? 0) || 0;

export function buildInvoicePaymentSummary(
  inv: InvoiceAmounts,
  taxStatus: InvoiceTaxStatus | undefined,
): InvoicePaymentSummary {
  const isPurchase = inv.partyType === 'PURCHASE';
  const taxable = num(inv.taxableAmount);
  const gstAmount = num(inv.gstAmount);
  const tdsAmount = num(inv.tdsAmount);
  const isHeld = Boolean(inv.isGstHold) && gstAmount > 0;
  const booked = num(inv.bookedTotal);
  const paid = num(inv.paidTotal);
  const advance = num(inv.advanceSettledAmount);

  const invoiceValue = money(taxable + gstAmount);
  const netPayable = money(taxable - tdsAmount + (isHeld ? 0 : gstAmount));

  const gstRegister = taxStatus?.gstStatus ?? null;
  const gstSettled = isHeld ? num(gstRegister?.settledAmount) : 0;
  const gst =
    gstAmount > 0
      ? {
          amount: money(gstAmount),
          isHeld,
          status: isHeld
            ? gstRegister?.settlementStatus && gstRegister.settlementStatus !== 'NOT_HELD'
              ? gstRegister.settlementStatus
              : ('PENDING' as GstSettlementStatus)
            : ('NOT_HELD' as GstSettlementStatus),
          settled: money(gstSettled),
          pending: isHeld ? positive(gstAmount - gstSettled) : 0,
          settledAt: isHeld ? gstRegister?.settledAt ?? null : null,
        }
      : null;

  const tdsRegister = taxStatus?.tdsStatus ?? null;
  const tdsCleared = isPurchase
    ? num(tdsRegister?.depositedAmount)
    : num(tdsRegister?.verifiedAmount);
  const tds =
    tdsAmount > 0
      ? {
          amount: money(tdsAmount),
          cleared: money(Math.min(tdsCleared, tdsAmount)),
          pending: positive(tdsAmount - tdsCleared),
          status: (isPurchase
            ? tdsRegister?.isDeposited
              ? tdsRegister.isVerified
                ? 'CLEARED'
                : 'DEPOSITED'
              : 'PENDING'
            : tdsRegister?.isVerified
            ? 'CLEARED'
            : 'PENDING') as InvoiceTdsClearance,
        }
      : null;

  const totalSettled = money(paid + advance + gstSettled + (tds?.cleared ?? 0));
  const totalBalance = positive(invoiceValue - totalSettled);

  return {
    invoiceValue,
    netPayable,
    booked: isPurchase ? money(booked) : null,
    paid: money(paid),
    awaitingTransfer: isPurchase ? positive(booked - paid) : null,
    toBook: isPurchase ? positive(netPayable - advance - booked) : null,
    advanceAdjusted: money(advance),
    paymentBalance: positive(netPayable - advance - paid),
    gst,
    tds,
    totalSettled,
    totalBalance,
    settledPercent:
      invoiceValue > 0 ? Math.min(Math.round((totalSettled / invoiceValue) * 100), 100) : 0,
  };
}
