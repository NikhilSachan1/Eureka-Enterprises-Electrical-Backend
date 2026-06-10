import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  DataSource,
  IsNull,
  ILike,
  In,
  Between,
  MoreThanOrEqual,
  LessThanOrEqual,
  Equal,
} from 'typeorm';
import { SiteInvoiceRepository } from './site-invoice.repository';
import { SiteInvoiceEntity } from './entities/site-invoice.entity';
import { CreateSiteInvoiceDto, UpdateSiteInvoiceDto, GetSiteInvoiceDto } from './dto';
import {
  ApproveDto,
  RejectDto,
  UnlockRequestDto,
} from 'src/modules/purchase-orders/dto/approval.dto';
import { INVOICE_ERRORS, INVOICE_RESPONSES } from './constants/site-invoice.constants';
import {
  insertGstRegisterEntryQuery,
  deleteGstRegisterEntryForInvoiceQuery,
  insertTdsRegisterEntryFromInvoiceQuery,
  deleteTdsRegisterEntryForInvoiceQuery,
} from './queries/site-invoice.queries';
import { formatUser } from 'src/modules/common/financials/user-format.helper';
import { JmcEntity } from 'src/modules/jmc/entities/jmc.entity';
import { SiteReportEntity } from 'src/modules/site-reports/entities/site-report.entity';
import { PurchaseOrderRepository } from 'src/modules/purchase-orders/purchase-order.repository';
import {
  PartyType,
  FinancialApprovalStatus,
  FINANCIAL_ERRORS,
  GstType,
  getFinancialYear,
} from 'src/modules/common/financials/financial.constants';
import { DefaultPaginationValues, SortOrder } from 'src/utils/utility/constants/utility.constants';

@Injectable()
export class SiteInvoiceService {
  constructor(
    private readonly invoiceRepository: SiteInvoiceRepository,
    private readonly poRepository: PurchaseOrderRepository,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateSiteInvoiceDto, createdBy: string) {
    const jmc = await this.dataSource
      .getRepository(JmcEntity)
      .findOne({ where: { id: dto.jmcId, deletedAt: IsNull() } });
    if (!jmc) throw new NotFoundException(INVOICE_ERRORS.JMC_NOT_FOUND);

    // 1 JMC = 1 Invoice
    const dup = await this.invoiceRepository.findOne({
      where: { jmcId: dto.jmcId, deletedAt: IsNull() },
    });
    if (dup) throw new ConflictException(INVOICE_ERRORS.INVOICE_ALREADY_EXISTS_FOR_JMC);

    // Auto-resolve reportId from JMC — PURCHASE side requires a report to exist first
    let resolvedReportId: string | null = null;
    if (jmc.partyType === PartyType.PURCHASE) {
      const report = await this.dataSource
        .getRepository(SiteReportEntity)
        .findOne({ where: { jmcId: dto.jmcId, deletedAt: IsNull() } });
      if (!report) throw new BadRequestException(INVOICE_ERRORS.REPORT_REQUIRED_FOR_PURCHASE);
      resolvedReportId = report.id;
    }

    this.validateAmounts(dto.taxableAmount, dto.gstAmount ?? 0, dto.totalAmount);

    // Ceiling check at save time — soft guard before the pessimistic-lock check at approval.
    // Sums all non-rejected invoices on this PO so users get immediate feedback.
    await this.assertPoCeiling(jmc.poId, dto.totalAmount, null);

    const created = await this.invoiceRepository.create({
      jmcId: jmc.id,
      reportId: resolvedReportId,
      siteId: jmc.siteId,
      partyType: jmc.partyType,
      contractorId: jmc.contractorId,
      vendorId: jmc.vendorId,
      poId: jmc.poId,
      invoiceNumber: dto.invoiceNumber,
      invoiceDate: new Date(dto.invoiceDate),
      taxableAmount: dto.taxableAmount,
      gstAmount: dto.gstAmount ?? 0,
      gstPercentage: dto.gstPercentage ?? null,
      tdsAmount: dto.tdsAmount ?? 0,
      tdsPercentage: dto.tdsPercentage ?? null,
      totalAmount: dto.totalAmount,
      fileKey: dto.fileKey,
      fileName: dto.fileName,
      remarks: dto.remarks,
      approvalStatus: FinancialApprovalStatus.PENDING,
      isLocked: false,
      createdBy,
    });

    return { message: INVOICE_RESPONSES.CREATED, id: created.id };
  }

  async findAll(query: GetSiteInvoiceDto) {
    const {
      jmcId,
      poId,
      companyId,
      siteId,
      partyType,
      contractorId,
      vendorId,
      approvalStatus,
      isLocked,
      dateFrom,
      dateTo,
      search,
      poNumber,
      jmcNumber,
      sortField = DefaultPaginationValues.SORT_FIELD,
      sortOrder = DefaultPaginationValues.SORT_ORDER,
      page = DefaultPaginationValues.PAGE,
      pageSize = DefaultPaginationValues.PAGE_SIZE,
    } = query;

    const where: any = { deletedAt: IsNull() };
    if (jmcId) where.jmcId = jmcId;
    if (poId) where.poId = poId;
    if (companyId?.length) where.site = { companyId: In(companyId) };
    if (siteId?.length) where.siteId = In(siteId);
    if (partyType) where.partyType = partyType;
    if (contractorId?.length) where.contractorId = In(contractorId);
    if (vendorId?.length) where.vendorId = In(vendorId);
    if (approvalStatus?.length) where.approvalStatus = In(approvalStatus);
    if (isLocked !== undefined) where.isLocked = Equal(isLocked === 'true');
    if (dateFrom && dateTo) where.invoiceDate = Between(dateFrom, dateTo);
    else if (dateFrom) where.invoiceDate = MoreThanOrEqual(dateFrom);
    else if (dateTo) where.invoiceDate = LessThanOrEqual(dateTo);
    if (search) where.invoiceNumber = ILike(`%${search}%`);
    if (jmcNumber || poNumber) {
      const jmcCond: any = {};
      if (jmcNumber) jmcCond.jmcNumber = ILike(`%${jmcNumber}%`);
      if (poNumber) jmcCond.po = { poNumber: ILike(`%${poNumber}%`) };
      where.jmc = jmcCond;
    }

    const [records, totalRecords] = await Promise.all([
      this.invoiceRepository.findAll({
        where,
        order: { [sortField]: sortOrder as SortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
        relations: [
          'jmc',
          'jmc.po',
          'report',
          'site',
          'site.company',
          'contractor',
          'vendor',
          'createdByUser',
          'updatedByUser',
          'approvalByUser',
          'unlockRequestedByUser',
        ],
      }),
      this.invoiceRepository.count({ where }),
    ]);

    return {
      records: records.map((inv) => {
        let isDisabled: boolean;
        let disabledReason: string | null;

        if (inv.partyType === PartyType.PURCHASE) {
          // PURCHASE: ceiling = taxableAmount − tdsAmount (TDS now at invoice level)
          const bookedTotal = Number(inv.bookedTotal) || 0;
          const netPayable = Number(inv.taxableAmount) - Number(inv.tdsAmount ?? 0);
          isDisabled = bookedTotal >= netPayable;
          disabledReason = isDisabled
            ? `Book payment ceiling fully used (₹${bookedTotal.toLocaleString(
                'en-IN',
              )} of ₹${netPayable.toLocaleString('en-IN')})`
            : null;
        } else {
          // SALE: ceiling = taxableAmount − tdsAmount (TDS now at invoice level)
          const paidTotal = Number(inv.paidTotal) || 0;
          const netPayable = Number(inv.taxableAmount) - Number(inv.tdsAmount ?? 0);
          isDisabled = paidTotal >= netPayable;
          disabledReason = isDisabled
            ? `Bank transfer ceiling fully used (₹${paidTotal.toLocaleString(
                'en-IN',
              )} of ₹${netPayable.toLocaleString('en-IN')})`
            : null;
        }

        return {
          ...inv,
          createdByUser: formatUser(inv.createdByUser),
          updatedByUser: formatUser(inv.updatedByUser),
          approvalByUser: formatUser(inv.approvalByUser),
          unlockRequestedByUser: formatUser(inv.unlockRequestedByUser),
          isDisabled,
          disabledReason,
        };
      }),
      totalRecords,
    };
  }

  async findById(id: string) {
    const invoice = await this.invoiceRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: [
        'jmc',
        'jmc.po',
        'report',
        'site',
        'site.company',
        'contractor',
        'vendor',
        'createdByUser',
        'updatedByUser',
        'approvalByUser',
        'unlockRequestedByUser',
      ],
    });
    if (!invoice) throw new NotFoundException(INVOICE_ERRORS.NOT_FOUND);
    return {
      ...invoice,
      createdByUser: formatUser(invoice.createdByUser),
      updatedByUser: formatUser(invoice.updatedByUser),
      approvalByUser: formatUser(invoice.approvalByUser),
      unlockRequestedByUser: formatUser(invoice.unlockRequestedByUser),
    };
  }

  async update(id: string, dto: UpdateSiteInvoiceDto, updatedBy: string) {
    const inv = await this.findActiveById(id);
    this.assertEditable(inv);

    // UpdateSiteInvoiceDto deliberately omits @Type(() => Number) so absent
    // numeric fields stay undefined under enableImplicitConversion.
    const newTaxable = dto.taxableAmount ?? Number(inv.taxableAmount);
    const newGst = dto.gstAmount ?? Number(inv.gstAmount);
    const newTotal = dto.totalAmount ?? Number(inv.totalAmount);
    this.validateAmounts(newTaxable, newGst, newTotal);

    // Ceiling check — exclude the current invoice so its own amount isn't double-counted.
    if (dto.totalAmount !== undefined) {
      await this.assertPoCeiling(inv.poId, newTotal, id);
    }

    await this.invoiceRepository.update({ id }, {
      ...dto,
      invoiceDate: dto.invoiceDate ? new Date(dto.invoiceDate) : undefined,
      updatedBy,
    } as Partial<SiteInvoiceEntity>);
    return { message: INVOICE_RESPONSES.UPDATED };
  }

  async remove(id: string, deletedBy: string) {
    const inv = await this.findActiveById(id);
    this.assertEditable(inv);

    const childCheck = await this.dataSource.query(
      `
        SELECT 1 FROM book_payments WHERE "invoiceId" = $1 AND "deletedAt" IS NULL
        UNION ALL
        SELECT 1 FROM bank_transfers WHERE "invoiceId" = $1 AND "deletedAt" IS NULL
        LIMIT 1
      `,
      [id],
    );
    if (childCheck.length > 0) {
      throw new BadRequestException(INVOICE_ERRORS.CANNOT_DELETE_HAS_CHILDREN);
    }

    await this.invoiceRepository.update({ id }, { deletedBy });
    await this.invoiceRepository.softDelete({ id });
    return { message: INVOICE_RESPONSES.DELETED };
  }

  /**
   * Approve invoice — runs in a transaction with PO row locked so that
   * concurrent approvals respect the PO ceiling. (Plan §3.4 hardening #8)
   */
  async approve(id: string, dto: ApproveDto, approvedBy: string) {
    return await this.dataSource.transaction(async (em) => {
      const inv = await em.getRepository(SiteInvoiceEntity).findOne({
        where: { id, deletedAt: IsNull() },
      });
      if (!inv) throw new NotFoundException(INVOICE_ERRORS.NOT_FOUND);
      if (inv.approvalStatus === FinancialApprovalStatus.APPROVED) {
        throw new ConflictException(FINANCIAL_ERRORS.ALREADY_APPROVED);
      }

      // Bottom-up chain: JMC must be APPROVED before Invoice can be approved
      const jmc = await em.getRepository(JmcEntity).findOne({
        where: { id: inv.jmcId, deletedAt: IsNull() },
      });
      if (!jmc || jmc.approvalStatus !== FinancialApprovalStatus.APPROVED) {
        throw new BadRequestException(INVOICE_ERRORS.JMC_NOT_APPROVED_FOR_APPROVAL);
      }

      // Lock PO + assert ceiling (also validates PO is APPROVED)
      const po = await this.poRepository.findOneForUpdate(inv.poId, em);
      if (!po) throw new NotFoundException(FINANCIAL_ERRORS.PARENT_NOT_FOUND);
      const newInvoicedTotal = Number(po.invoicedTotal) + Number(inv.totalAmount);
      if (newInvoicedTotal > Number(po.totalAmount)) {
        throw new BadRequestException(FINANCIAL_ERRORS.PO_CEILING_EXCEEDED);
      }

      // Approve invoice
      await em.getRepository(SiteInvoiceEntity).update(
        { id },
        {
          approvalStatus: FinancialApprovalStatus.APPROVED,
          approvalBy: approvedBy,
          approvalAt: new Date(),
          approvalReason: dto.reason ?? null,
          isLocked: true,
          unlockRequestedAt: null,
          unlockRequestedBy: null,
          unlockReason: null,
          updatedBy: approvedBy,
        },
      );

      // Maintain PO rollup
      await this.poRepository.adjustRollups(
        inv.poId,
        { invoicedTotal: Number(inv.totalAmount), lastInvoiceAt: new Date() },
        em,
      );

      // Project GST + TDS register entries atomically with approval.
      await this.projectGstRegisterEntry(inv, em);
      await this.projectTdsRegisterEntry(inv, em);

      return { message: INVOICE_RESPONSES.APPROVED };
    });
  }

  private async projectGstRegisterEntry(
    inv: SiteInvoiceEntity,
    em: import('typeorm').EntityManager,
  ) {
    // Always delete the existing unverified/unpaid entry first.
    // This ensures re-approval after editing picks up new taxable/gst amounts,
    // a shifted invoice date (FY partition change), or party changes.
    // Safe no-op if the entry is verified or already payment-released.
    await em.query(deleteGstRegisterEntryForInvoiceQuery, [inv.id]);

    if (Number(inv.gstAmount) === 0) return; // no GST — entry cleaned up above, nothing to insert

    const invoiceDate = new Date(inv.invoiceDate);
    const invoiceMonth = `${invoiceDate.getUTCFullYear()}-${String(
      invoiceDate.getUTCMonth() + 1,
    ).padStart(2, '0')}`;
    const financialYear = getFinancialYear(invoiceDate);
    const gstType = inv.partyType === PartyType.PURCHASE ? GstType.GST_3B : GstType.GST_1;

    await em.query(insertGstRegisterEntryQuery, [
      inv.id,
      inv.siteId,
      inv.partyType,
      inv.contractorId ?? null,
      inv.vendorId ?? null,
      invoiceMonth,
      financialYear,
      gstType,
      Number(inv.taxableAmount),
      Number(inv.gstAmount),
    ]);
  }

  private async projectTdsRegisterEntry(
    inv: SiteInvoiceEntity,
    em: import('typeorm').EntityManager,
  ) {
    if (Number(inv.tdsAmount ?? 0) === 0) return;

    // Delete any existing unverified/unpaid invoice-level TDS entry first.
    // Re-approval after an edit picks up the updated taxable/tds amounts.
    await em.query(deleteTdsRegisterEntryForInvoiceQuery, [inv.id]);

    const invoiceDate = new Date(inv.invoiceDate);
    const invoiceMonth = `${invoiceDate.getUTCFullYear()}-${String(
      invoiceDate.getUTCMonth() + 1,
    ).padStart(2, '0')}`;
    const financialYear = getFinancialYear(invoiceDate);

    await em.query(insertTdsRegisterEntryFromInvoiceQuery, [
      inv.id,
      inv.siteId,
      inv.partyType,
      inv.contractorId ?? null,
      inv.vendorId ?? null,
      invoiceMonth,
      financialYear,
      Number(inv.taxableAmount),
      Number(inv.tdsAmount),
    ]);
  }

  async reject(id: string, dto: RejectDto, rejectedBy: string) {
    const inv = await this.findActiveById(id);
    if (inv.approvalStatus === FinancialApprovalStatus.APPROVED) {
      throw new BadRequestException(FINANCIAL_ERRORS.CANNOT_REJECT_APPROVED);
    }
    if (inv.approvalStatus === FinancialApprovalStatus.REJECTED) {
      throw new ConflictException(FINANCIAL_ERRORS.ALREADY_REJECTED);
    }
    await this.invoiceRepository.update(
      { id },
      {
        approvalStatus: FinancialApprovalStatus.REJECTED,
        approvalBy: rejectedBy,
        approvalAt: new Date(),
        approvalReason: dto.reason,
        isLocked: false,
        updatedBy: rejectedBy,
      },
    );
    return { message: INVOICE_RESPONSES.REJECTED };
  }

  async rejectUnlock(id: string, rejectedBy: string) {
    const inv = await this.findActiveById(id);
    if (!inv.unlockRequestedAt) {
      throw new BadRequestException(FINANCIAL_ERRORS.UNLOCK_REJECT_NO_REQUEST);
    }
    await this.invoiceRepository.update(
      { id },
      {
        unlockRequestedAt: null,
        unlockRequestedBy: null,
        unlockReason: null,
        updatedBy: rejectedBy,
      },
    );
    return { message: INVOICE_RESPONSES.UNLOCK_REJECTED };
  }

  async requestUnlock(id: string, dto: UnlockRequestDto, requestedBy: string) {
    const inv = await this.findActiveById(id);
    if (!inv.isLocked || inv.approvalStatus !== FinancialApprovalStatus.APPROVED) {
      throw new BadRequestException(INVOICE_ERRORS.ONLY_APPROVED_LOCKED_CAN_REQUEST_UNLOCK);
    }
    await this.invoiceRepository.update(
      { id },
      {
        unlockRequestedAt: new Date(),
        unlockRequestedBy: requestedBy,
        unlockReason: dto.reason,
        updatedBy: requestedBy,
      },
    );
    return { message: INVOICE_RESPONSES.UNLOCK_REQUESTED };
  }

  /**
   * Grant unlock — also reverses the PO rollup since the invoice goes back to PENDING.
   */
  async grantUnlock(id: string, grantedBy: string) {
    return await this.dataSource.transaction(async (em) => {
      const inv = await em.getRepository(SiteInvoiceEntity).findOne({
        where: { id, deletedAt: IsNull() },
      });
      if (!inv) throw new NotFoundException(INVOICE_ERRORS.NOT_FOUND);
      if (!inv.unlockRequestedAt) {
        throw new BadRequestException(FINANCIAL_ERRORS.UNLOCK_NOT_REQUESTED);
      }

      // Reverse rollup if invoice was approved
      if (inv.approvalStatus === FinancialApprovalStatus.APPROVED) {
        await this.poRepository.findOneForUpdate(inv.poId, em);
        await this.poRepository.adjustRollups(
          inv.poId,
          { invoicedTotal: -Number(inv.totalAmount) },
          em,
        );

        // Block unlock if GST payment has already been released — the entry is
        // immutable and cannot be re-projected with edited amounts.
        const gstPaid = await em.query(
          `SELECT 1 FROM gst_register_entries
           WHERE "invoiceId" = $1 AND "gstPaymentId" IS NOT NULL
           LIMIT 1`,
          [id],
        );
        if (gstPaid.length > 0) {
          throw new BadRequestException(FINANCIAL_ERRORS.CANNOT_UNLOCK_GST_PAID);
        }

        // Block unlock if TDS payment has already been released against this invoice's TDS entry.
        const tdsPaid = await em.query(
          `SELECT 1 FROM tds_register_entries
           WHERE "invoiceId" = $1
             AND "bookPaymentId" IS NULL
             AND "bankTransferId" IS NULL
             AND "tdsPaymentId" IS NOT NULL
           LIMIT 1`,
          [id],
        );
        if (tdsPaid.length > 0) {
          throw new BadRequestException(FINANCIAL_ERRORS.CANNOT_UNLOCK_TDS_PAID);
        }

        // Wipe ALL GST entries for this invoice (verified or not — paid ones
        // are blocked above). On re-approval, projectGstRegisterEntry creates a
        // fresh row that reflects the post-edit amounts / invoice date.
        await em.query(`DELETE FROM gst_register_entries WHERE "invoiceId" = $1`, [id]);

        // Wipe invoice-level TDS entries. On re-approval, projectTdsRegisterEntry re-creates.
        await em.query(
          `DELETE FROM tds_register_entries
           WHERE "invoiceId" = $1 AND "bookPaymentId" IS NULL AND "bankTransferId" IS NULL`,
          [id],
        );
      }

      await em.getRepository(SiteInvoiceEntity).update(
        { id },
        {
          approvalStatus: FinancialApprovalStatus.PENDING,
          approvalBy: null,
          approvalAt: null,
          approvalReason: null,
          isLocked: false,
          unlockRequestedAt: null,
          unlockRequestedBy: null,
          unlockReason: null,
          updatedBy: grantedBy,
        },
      );

      return { message: INVOICE_RESPONSES.UNLOCK_GRANTED };
    });
  }

  // Helpers

  private async findActiveById(id: string): Promise<SiteInvoiceEntity> {
    const inv = await this.invoiceRepository.findOne({ where: { id, deletedAt: IsNull() } });
    if (!inv) throw new NotFoundException(INVOICE_ERRORS.NOT_FOUND);
    return inv;
  }

  private assertEditable(inv: SiteInvoiceEntity): void {
    if (inv.approvalStatus !== FinancialApprovalStatus.PENDING) {
      throw new BadRequestException(FINANCIAL_ERRORS.CANNOT_DELETE_NOT_PENDING);
    }
    if (inv.isLocked) {
      throw new BadRequestException(FINANCIAL_ERRORS.CANNOT_EDIT_LOCKED);
    }
  }

  private validateAmounts(taxable: number, gst: number, total: number): void {
    const expected = Number((Number(taxable) + Number(gst)).toFixed(2));
    const got = Number(Number(total).toFixed(2));
    if (expected !== got) {
      throw new BadRequestException(INVOICE_ERRORS.AMOUNT_VALIDATION_FAILED);
    }
  }

  /**
   * Soft ceiling check at create / update time.
   *
   * Sums ALL non-rejected, non-deleted invoices on the PO (excluding the
   * invoice being edited, if any) and compares against PO.totalAmount.
   *
   * This is a user-friendly guard so operators see the error immediately.
   * The hard, race-condition-proof check still runs inside the approval
   * transaction with a pessimistic PO lock (approve() method).
   *
   * @param poId          - PO the invoice belongs to
   * @param newTotal      - totalAmount of the invoice being saved
   * @param excludeId     - id of the invoice being updated (null on create)
   */
  private async assertPoCeiling(
    poId: string,
    newTotal: number,
    excludeId: string | null,
  ): Promise<void> {
    // Load PO total amount
    const [poRow] = await this.dataSource.query<{ totalAmount: string }[]>(
      `SELECT "totalAmount" FROM purchase_orders WHERE id = $1 AND "deletedAt" IS NULL`,
      [poId],
    );
    if (!poRow) return; // PO vanished — approve() will catch it with a lock

    // Sum all non-rejected invoices on this PO (pending + approved)
    const [sumRow] = await this.dataSource.query<{ existing: string }[]>(
      `SELECT COALESCE(SUM("totalAmount"), 0) AS existing
         FROM site_invoices
        WHERE "poId" = $1
          AND "deletedAt" IS NULL
          AND "approvalStatus" != 'REJECTED'
          ${excludeId ? `AND id != $2` : ''}`,
      excludeId ? [poId, excludeId] : [poId],
    );

    const existing = Number(sumRow?.existing ?? 0);
    const poTotal = Number(poRow.totalAmount);

    if (existing + Number(newTotal) > poTotal) {
      throw new BadRequestException(INVOICE_ERRORS.PO_CEILING_EXCEEDED_ON_SAVE);
    }
  }

  /**
   * Dropdown endpoint — returns Invoices for a site with eligibility flags.
   *
   * forDocument = "book-payment"                   → PURCHASE invoices. Eligible: APPROVED + bookedTotal < taxableAmount − tdsAmount.
   * forDocument = "bank-transfer" + PURCHASE        → PURCHASE invoices booked but not yet paid. Eligible: APPROVED + bookedTotal > 0 + paidTotal < bookedTotal.
   * forDocument = "bank-transfer" + SALE (default)  → SALE invoices. Eligible: APPROVED + paidTotal < taxableAmount − tdsAmount.
   */
  async getDropdown(
    siteId: string,
    forDocument: 'book-payment' | 'bank-transfer',
    partyTypeOverride?: 'PURCHASE' | 'SALE',
  ) {
    const partyType = partyTypeOverride ?? (forDocument === 'book-payment' ? 'PURCHASE' : 'SALE');

    const isPurchaseBankTransfer = forDocument === 'bank-transfer' && partyType === 'PURCHASE';

    const rows = await this.dataSource.query(
      `
      SELECT
        i.id,
        i."invoiceNumber",
        i."invoiceDate",
        i."partyType",
        i."taxableAmount",
        i."tdsAmount",
        i."totalAmount",
        i."bookedTotal",
        i."paidTotal",
        i."approvalStatus",
        COALESCE(c.name, v.name) AS "partyName",
        CASE
          WHEN i."approvalStatus" != 'APPROVED'                                                                                           THEN false
          WHEN $3 = 'book-payment'                       AND i."bookedTotal" >= i."taxableAmount" - COALESCE(i."tdsAmount", 0)            THEN false
          WHEN $3 = 'bank-transfer' AND $4 = 'PURCHASE'  AND i."bookedTotal" = 0                                                         THEN false
          WHEN $3 = 'bank-transfer' AND $4 = 'PURCHASE'  AND i."paidTotal"   >= i."bookedTotal"                                          THEN false
          WHEN $3 = 'bank-transfer' AND $4 != 'PURCHASE' AND i."paidTotal"   >= i."taxableAmount" - COALESCE(i."tdsAmount", 0)           THEN false
          ELSE true
        END AS eligible,
        CASE
          WHEN i."approvalStatus" = 'PENDING'  THEN 'Invoice is pending admin approval'
          WHEN i."approvalStatus" = 'REJECTED' THEN 'Invoice was rejected'
          WHEN $3 = 'book-payment' AND i."bookedTotal" >= i."taxableAmount" - COALESCE(i."tdsAmount", 0)
            THEN 'Invoice fully booked — no remaining net payable amount'
          WHEN $3 = 'bank-transfer' AND $4 = 'PURCHASE' AND i."bookedTotal" = 0
            THEN 'Invoice not yet booked — do a Book Payment first'
          WHEN $3 = 'bank-transfer' AND $4 = 'PURCHASE' AND i."paidTotal" >= i."bookedTotal"
            THEN 'Invoice fully paid — booked amount exhausted'
          WHEN $3 = 'bank-transfer' AND $4 != 'PURCHASE' AND i."paidTotal" >= i."taxableAmount" - COALESCE(i."tdsAmount", 0)
            THEN 'Invoice fully paid — net payable amount exhausted'
          ELSE NULL
        END AS reason
      FROM site_invoices i
      LEFT JOIN contractors c ON c.id = i."contractorId" AND c."deletedAt" IS NULL
      LEFT JOIN vendors     v ON v.id = i."vendorId"     AND v."deletedAt" IS NULL
      WHERE i."siteId"    = $1
        AND i."partyType" = $2
        AND i."deletedAt" IS NULL
      ORDER BY i."createdAt" DESC
      `,
      [siteId, partyType, forDocument, partyType],
    );

    return {
      records: rows.map((r: any) => ({
        id: r.id,
        label: `${r.invoiceNumber} — ${r.partyName ?? 'Unknown'}`,
        eligible: r.eligible,
        reason: r.reason ?? null,
        meta: {
          invoiceNumber: r.invoiceNumber,
          partyType: r.partyType,
          partyName: r.partyName,
          taxableAmount: Number(r.taxableAmount),
          tdsAmount: Number(r.tdsAmount ?? 0),
          totalAmount: Number(r.totalAmount),
          bookedTotal: Number(r.bookedTotal),
          paidTotal: Number(r.paidTotal),
          remaining: isPurchaseBankTransfer
            ? Number(r.bookedTotal) - Number(r.paidTotal)
            : forDocument === 'book-payment'
            ? Number(r.taxableAmount) - Number(r.tdsAmount ?? 0) - Number(r.bookedTotal)
            : Number(r.taxableAmount) - Number(r.tdsAmount ?? 0) - Number(r.paidTotal),
          approvalStatus: r.approvalStatus,
        },
      })),
    };
  }
}
