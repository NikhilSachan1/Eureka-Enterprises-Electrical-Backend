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
import { insertGstRegisterEntryQuery } from './queries/site-invoice.queries';
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
    if (jmc.approvalStatus !== FinancialApprovalStatus.APPROVED) {
      throw new BadRequestException(INVOICE_ERRORS.JMC_NOT_APPROVED);
    }

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
      records: records.map((inv) => ({
        ...inv,
        createdByUser: formatUser(inv.createdByUser),
        updatedByUser: formatUser(inv.updatedByUser),
        approvalByUser: formatUser(inv.approvalByUser),
        unlockRequestedByUser: formatUser(inv.unlockRequestedByUser),
      })),
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

      // Lock PO + assert ceiling
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

      // Project GST + TDS register entries (Plan §5.1.13 + §5.1.15).
      // These are created atomically with the approval so they always exist
      // exactly when (and only when) the invoice is approved.
      await this.projectGstRegisterEntry(inv, em);
      // TDS is now projected from book payments, not invoice approval

      return { message: INVOICE_RESPONSES.APPROVED };
    });
  }

  private async projectGstRegisterEntry(
    inv: SiteInvoiceEntity,
    em: import('typeorm').EntityManager,
  ) {
    if (Number(inv.gstAmount) === 0) return; // no GST on this invoice — nothing to project
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
   * Dropdown endpoint — returns Invoices for a site with eligibility flags.
   *
   * forDocument = "book-payment"   → PURCHASE invoices for Book Payment creation.
   *   Eligible: APPROVED + bookedTotal < totalAmount.
   *
   * forDocument = "bank-transfer"  → SALE invoices for SALE Bank Transfer creation.
   *   Eligible: APPROVED + paidTotal < totalAmount.
   */
  async getDropdown(siteId: string, forDocument: 'book-payment' | 'bank-transfer') {
    const partyType = forDocument === 'book-payment' ? 'PURCHASE' : 'SALE';
    const rows = await this.dataSource.query(
      `
      SELECT
        i.id,
        i."invoiceNumber",
        i."invoiceDate",
        i."partyType",
        i."totalAmount",
        i."bookedTotal",
        i."paidTotal",
        i."approvalStatus",
        COALESCE(c.name, v.name) AS "partyName",
        -- eligibility
        CASE
          WHEN i."approvalStatus" != 'APPROVED' THEN false
          WHEN $3 = 'book-payment'  AND i."bookedTotal" >= i."totalAmount" THEN false
          WHEN $3 = 'bank-transfer' AND i."paidTotal"   >= i."totalAmount" THEN false
          ELSE true
        END AS eligible,
        CASE
          WHEN i."approvalStatus" = 'PENDING'  THEN 'Invoice is pending admin approval'
          WHEN i."approvalStatus" = 'REJECTED' THEN 'Invoice was rejected'
          WHEN $3 = 'book-payment'  AND i."bookedTotal" >= i."totalAmount"
            THEN 'Invoice fully booked — no remaining amount'
          WHEN $3 = 'bank-transfer' AND i."paidTotal"   >= i."totalAmount"
            THEN 'Invoice fully paid'
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
      [siteId, partyType, forDocument],
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
          totalAmount: Number(r.totalAmount),
          bookedTotal: Number(r.bookedTotal),
          paidTotal: Number(r.paidTotal),
          remaining:
            forDocument === 'book-payment'
              ? Number(r.totalAmount) - Number(r.bookedTotal)
              : Number(r.totalAmount) - Number(r.paidTotal),
          approvalStatus: r.approvalStatus,
        },
      })),
    };
  }
}
