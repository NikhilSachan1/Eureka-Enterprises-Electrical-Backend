import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource, IsNull, ILike, In, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { BookPaymentRepository } from './book-payment.repository';
import { BookPaymentEntity } from './entities/book-payment.entity';
import { CreateBookPaymentDto, UpdateBookPaymentDto, GetBookPaymentDto } from './dto';
import { BOOK_PAYMENT_ERRORS, BOOK_PAYMENT_RESPONSES } from './constants/book-payment.constants';
import { formatUser } from 'src/modules/common/financials/user-format.helper';
import { SiteInvoiceEntity } from 'src/modules/site-invoices/entities/site-invoice.entity';
import { PurchaseOrderService } from 'src/modules/purchase-orders/purchase-order.service';
import { getFinancialYear } from 'src/modules/common/financials/financial.constants';
import {
  insertTdsRegisterEntryFromBookPaymentQuery,
  deleteTdsRegisterEntryForBookPaymentQuery,
} from 'src/modules/site-invoices/queries/site-invoice.queries';
import {
  PartyType,
  FinancialApprovalStatus,
} from 'src/modules/common/financials/financial.constants';
import { DefaultPaginationValues, SortOrder } from 'src/utils/utility/constants/utility.constants';

@Injectable()
export class BookPaymentService {
  constructor(
    private readonly bookPaymentRepository: BookPaymentRepository,
    private readonly purchaseOrderService: PurchaseOrderService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create a book payment — runs in a transaction with the invoice locked
   * to enforce the ceiling check (Σ booked ≤ invoice total).
   */
  async create(dto: CreateBookPaymentDto, createdBy: string) {
    return await this.dataSource.transaction(async (em) => {
      // Lock invoice + validate
      const invoice = await em
        .getRepository(SiteInvoiceEntity)
        .createQueryBuilder('inv')
        .setLock('pessimistic_write')
        .where('inv.id = :id', { id: dto.invoiceId })
        .andWhere('inv."deletedAt" IS NULL')
        .getOne();

      if (!invoice) throw new NotFoundException(BOOK_PAYMENT_ERRORS.INVOICE_NOT_FOUND);
      if (invoice.partyType !== PartyType.PURCHASE) {
        throw new BadRequestException(BOOK_PAYMENT_ERRORS.INVOICE_NOT_PURCHASE);
      }
      if (invoice.approvalStatus !== FinancialApprovalStatus.APPROVED) {
        throw new BadRequestException(BOOK_PAYMENT_ERRORS.INVOICE_NOT_APPROVED);
      }

      const gstAmount = dto.gstAmount ?? 0;
      const tdsAmount = dto.tdsDeductionAmount ?? 0;
      // paymentTotalAmount is on taxable only — GST tracked separately in GST register
      const paymentTotalAmount = this.computePaymentTotal(dto.taxableAmount, tdsAmount);

      if (paymentTotalAmount < 0) {
        throw new BadRequestException(BOOK_PAYMENT_ERRORS.AMOUNT_VALIDATION_FAILED);
      }

      // Ceiling check: sum of booked + new ≤ invoice taxable amount (GST excluded)
      const existingBooked = await this.bookPaymentRepository.sumByInvoice(dto.invoiceId, em);
      const newTotal = existingBooked + paymentTotalAmount;
      if (newTotal > Number(invoice.taxableAmount)) {
        throw new BadRequestException(BOOK_PAYMENT_ERRORS.INVOICE_CEILING_EXCEEDED);
      }

      // Create book payment (auto-approved)
      const created = await this.bookPaymentRepository.create(
        {
          invoiceId: invoice.id,
          siteId: invoice.siteId,
          vendorId: invoice.vendorId,
          poId: invoice.poId,
          bookingDate: new Date(dto.bookingDate),
          taxableAmount: dto.taxableAmount,
          gstAmount,
          gstPercentage: dto.gstPercentage ?? null,
          tdsDeductionAmount: tdsAmount,
          tdsPercentage: dto.tdsPercentage ?? null,
          paymentTotalAmount,
          paymentHoldReason: dto.paymentHoldReason ?? null,
          remarks: dto.remarks ?? null,
          approvalStatus: FinancialApprovalStatus.APPROVED,
          approvalBy: createdBy,
          approvalAt: new Date(),
          hasTransfer: false,
          createdBy,
        },
        em,
      );

      // Update invoice bookedTotal + PO bookedTotal
      await em
        .getRepository(SiteInvoiceEntity)
        .update({ id: invoice.id }, { bookedTotal: () => `"bookedTotal" + ${paymentTotalAmount}` });

      await this.purchaseOrderService.adjustRollups(
        invoice.poId,
        { bookedTotal: paymentTotalAmount },
        em,
      );

      // Project TDS register entry if TDS was deducted
      if (tdsAmount > 0) {
        const bookingDate = new Date(dto.bookingDate);
        const invoiceMonth = `${bookingDate.getUTCFullYear()}-${String(
          bookingDate.getUTCMonth() + 1,
        ).padStart(2, '0')}`;
        const financialYear = getFinancialYear(bookingDate);
        await em.query(insertTdsRegisterEntryFromBookPaymentQuery, [
          invoice.id,
          created.id,
          invoice.siteId,
          invoice.partyType,
          invoice.contractorId ?? null,
          invoice.vendorId ?? null,
          invoiceMonth,
          financialYear,
          Number(dto.taxableAmount),
          tdsAmount,
        ]);
      }

      return { message: BOOK_PAYMENT_RESPONSES.CREATED, id: created.id };
    });
  }

  async findAll(query: GetBookPaymentDto) {
    const {
      invoiceId,
      companyId,
      siteId,
      vendorId,
      poId,
      dateFrom,
      dateTo,
      search,
      poNumber,
      invoiceNumber,
      sortField = DefaultPaginationValues.SORT_FIELD,
      sortOrder = DefaultPaginationValues.SORT_ORDER,
      page = DefaultPaginationValues.PAGE,
      pageSize = DefaultPaginationValues.PAGE_SIZE,
    } = query;

    const where: any = { deletedAt: IsNull() };
    if (invoiceId) where.invoiceId = invoiceId;
    if (companyId?.length) where.site = { companyId: In(companyId) };
    if (siteId?.length) where.siteId = In(siteId);
    if (vendorId?.length) where.vendorId = In(vendorId);
    if (poId) where.poId = poId;
    if (dateFrom && dateTo) where.bookingDate = Between(dateFrom, dateTo);
    else if (dateFrom) where.bookingDate = MoreThanOrEqual(dateFrom);
    else if (dateTo) where.bookingDate = LessThanOrEqual(dateTo);
    if (search) where.remarks = ILike(`%${search}%`);
    if (invoiceNumber || poNumber) {
      const invCond: any = {};
      if (invoiceNumber) invCond.invoiceNumber = ILike(`%${invoiceNumber}%`);
      if (poNumber) invCond.jmc = { po: { poNumber: ILike(`%${poNumber}%`) } };
      where.invoice = invCond;
    }

    const [records, totalRecords] = await Promise.all([
      this.bookPaymentRepository.findAll({
        where,
        order: { [sortField]: sortOrder as SortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
        relations: [
          'invoice',
          'invoice.jmc',
          'invoice.jmc.po',
          'site',
          'site.company',
          'vendor',
          'createdByUser',
          'updatedByUser',
          'approvalByUser',
        ],
      }),
      this.bookPaymentRepository.count({ where }),
    ]);

    return {
      records: records.map((bp) => ({
        ...bp,
        createdByUser: formatUser(bp.createdByUser),
        updatedByUser: formatUser(bp.updatedByUser),
        approvalByUser: formatUser(bp.approvalByUser),
      })),
      totalRecords,
    };
  }

  async findById(id: string) {
    const bp = await this.bookPaymentRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: [
        'invoice',
        'invoice.jmc',
        'invoice.jmc.po',
        'site',
        'site.company',
        'vendor',
        'createdByUser',
        'updatedByUser',
        'approvalByUser',
      ],
    });
    if (!bp) throw new NotFoundException(BOOK_PAYMENT_ERRORS.NOT_FOUND);
    return {
      ...bp,
      createdByUser: formatUser(bp.createdByUser),
      updatedByUser: formatUser(bp.updatedByUser),
      approvalByUser: formatUser(bp.approvalByUser),
    };
  }

  async update(id: string, dto: UpdateBookPaymentDto, updatedBy: string) {
    return await this.dataSource.transaction(async (em) => {
      const bp = await this.bookPaymentRepository.findOneForUpdate(id, em);
      if (!bp) throw new NotFoundException(BOOK_PAYMENT_ERRORS.NOT_FOUND);

      if (bp.hasTransfer) {
        throw new BadRequestException(BOOK_PAYMENT_ERRORS.CANNOT_UPDATE_HAS_TRANSFER);
      }

      // Block edits if TDS payment has been released — the register row is immutable.
      const tdsRelevantForBlock =
        dto.tdsDeductionAmount !== undefined ||
        dto.taxableAmount !== undefined ||
        dto.bookingDate !== undefined;
      if (tdsRelevantForBlock) {
        const tdsPaid = await em.query(
          `SELECT 1 FROM tds_register_entries
           WHERE "bookPaymentId" = $1 AND "tdsPaymentId" IS NOT NULL
           LIMIT 1`,
          [id],
        );
        if (tdsPaid.length > 0) {
          throw new BadRequestException(BOOK_PAYMENT_ERRORS.CANNOT_UPDATE_TDS_PAID);
        }
      }

      // UpdateBookPaymentDto omits @Type(() => Number); absent fields stay
      // undefined under enableImplicitConversion so ?? fallback is safe.
      const newTaxable = dto.taxableAmount ?? Number(bp.taxableAmount);
      const newTds = dto.tdsDeductionAmount ?? Number(bp.tdsDeductionAmount);
      // GST excluded from payment total — only taxable - tds
      const newTotal = this.computePaymentTotal(newTaxable, newTds);

      if (newTotal < 0) {
        throw new BadRequestException(BOOK_PAYMENT_ERRORS.AMOUNT_VALIDATION_FAILED);
      }

      // Re-check ceiling if any amount field changed.
      const amountsChanged =
        dto.taxableAmount !== undefined ||
        dto.gstAmount !== undefined ||
        dto.tdsDeductionAmount !== undefined;

      if (amountsChanged) {
        const invoice = await em
          .getRepository(SiteInvoiceEntity)
          .createQueryBuilder('inv')
          .setLock('pessimistic_write')
          .where('inv.id = :id', { id: bp.invoiceId })
          .andWhere('inv."deletedAt" IS NULL')
          .getOne();
        if (!invoice) throw new NotFoundException(BOOK_PAYMENT_ERRORS.INVOICE_NOT_FOUND);

        // Ceiling is invoice taxableAmount — GST is excluded from book payment
        const existingBooked = await this.bookPaymentRepository.sumByInvoice(bp.invoiceId, em);
        const adjustedBooked = existingBooked - Number(bp.paymentTotalAmount) + newTotal;
        if (adjustedBooked > Number(invoice.taxableAmount)) {
          throw new BadRequestException(BOOK_PAYMENT_ERRORS.INVOICE_CEILING_EXCEEDED);
        }

        const delta = newTotal - Number(bp.paymentTotalAmount);
        if (delta !== 0) {
          await em
            .getRepository(SiteInvoiceEntity)
            .update({ id: bp.invoiceId }, { bookedTotal: () => `"bookedTotal" + ${delta}` });
          await this.purchaseOrderService.adjustRollups(bp.poId, { bookedTotal: delta }, em);
        }
      }

      const { taxableAmount, gstAmount, tdsDeductionAmount, ...restDto } = dto;
      await this.bookPaymentRepository.update(
        { id },
        {
          ...restDto,
          ...(taxableAmount !== undefined && { taxableAmount }),
          ...(gstAmount !== undefined && { gstAmount }),
          ...(tdsDeductionAmount !== undefined && { tdsDeductionAmount }),
          ...(amountsChanged && { paymentTotalAmount: newTotal }),
          bookingDate: dto.bookingDate ? new Date(dto.bookingDate) : undefined,
          updatedBy,
        } as Partial<BookPaymentEntity>,
        em,
      );

      // Re-sync TDS register when tdsDeductionAmount, taxableAmount, or bookingDate changes.
      // Strategy: delete the existing unverified/unpaid row, then re-insert with fresh values.
      // This cleanly handles FY shifts (bookingDate change moves to a different partition)
      // and amount edits without requiring ON CONFLICT DO UPDATE (which can't touch verified rows).
      if (tdsRelevantForBlock) {
        await em.query(deleteTdsRegisterEntryForBookPaymentQuery, [id]);

        if (newTds > 0) {
          const effectiveDate = dto.bookingDate
            ? new Date(dto.bookingDate)
            : new Date(bp.bookingDate);
          const invoiceMonth = `${effectiveDate.getUTCFullYear()}-${String(
            effectiveDate.getUTCMonth() + 1,
          ).padStart(2, '0')}`;
          const financialYear = getFinancialYear(effectiveDate);
          await em.query(insertTdsRegisterEntryFromBookPaymentQuery, [
            bp.invoiceId, // $1 invoiceId
            id, // $2 bookPaymentId
            bp.siteId, // $3 siteId
            PartyType.PURCHASE, // $4 partyType
            null, // $5 contractorId (PURCHASE has none)
            bp.vendorId, // $6 vendorId
            invoiceMonth, // $7
            financialYear, // $8
            newTaxable, // $9 taxableAmount
            newTds, // $10 tdsAmount
          ]);
        }
      }

      return { message: BOOK_PAYMENT_RESPONSES.UPDATED };
    });
  }

  async remove(id: string, deletedBy: string) {
    return await this.dataSource.transaction(async (em) => {
      const bp = await this.bookPaymentRepository.findOneForUpdate(id, em);
      if (!bp) throw new NotFoundException(BOOK_PAYMENT_ERRORS.NOT_FOUND);

      if (bp.hasTransfer) {
        throw new BadRequestException(BOOK_PAYMENT_ERRORS.CANNOT_DELETE_HAS_TRANSFER);
      }

      // Block deletion if TDS payment has been released against this book payment.
      const tdsPaid = await em.query(
        `SELECT 1 FROM tds_register_entries
         WHERE "bookPaymentId" = $1 AND "tdsPaymentId" IS NOT NULL
         LIMIT 1`,
        [id],
      );
      if (tdsPaid.length > 0) {
        throw new BadRequestException(BOOK_PAYMENT_ERRORS.CANNOT_DELETE_TDS_PAID);
      }

      // Remove the projected TDS register row so summaries don't include a
      // dangling deduction for a deleted book payment.
      await em.query(deleteTdsRegisterEntryForBookPaymentQuery, [id]);

      // Reverse rollups
      await em
        .getRepository(SiteInvoiceEntity)
        .update(
          { id: bp.invoiceId },
          { bookedTotal: () => `"bookedTotal" - ${bp.paymentTotalAmount}` },
        );
      await this.purchaseOrderService.adjustRollups(
        bp.poId,
        { bookedTotal: -Number(bp.paymentTotalAmount) },
        em,
      );

      await this.bookPaymentRepository.update({ id }, { deletedBy }, em);
      await this.bookPaymentRepository.softDelete({ id }, em);

      return { message: BOOK_PAYMENT_RESPONSES.DELETED };
    });
  }

  private computePaymentTotal(taxable: number, tds: number): number {
    // paymentTotalAmount = taxableAmount - tdsDeductionAmount
    // GST is NOT included here — it is tracked separately in the GST register
    // and paid to the government via the GST payment flow.
    // TDS is deducted at source from the taxable amount before paying the vendor.
    return Number((taxable - tds).toFixed(2));
  }

  // ── Service methods exposed for downstream modules (proper service-to-service communication) ────────────

  /**
   * Lock a book payment row inside a transaction for bank transfer validation.
   * Used by BankTransferService.
   */
  async findOneForUpdate(
    id: string,
    em: import('typeorm').EntityManager,
  ): Promise<BookPaymentEntity | null> {
    return await this.bookPaymentRepository.findOneForUpdate(id, em);
  }

  /**
   * Mark a book payment as having a bank transfer.
   * Used by BankTransferService.
   */
  async markHasTransfer(
    id: string,
    hasTransfer: boolean,
    em: import('typeorm').EntityManager,
  ): Promise<void> {
    await this.bookPaymentRepository.update({ id }, { hasTransfer }, em);
  }

  /**
   * Dropdown endpoint — returns Book Payments for an Invoice with eligibility
   * flags for PURCHASE Bank Transfer creation.
   *
   * A Book Payment is eligible when it does NOT yet have a Bank Transfer
   * (1 BookPayment = 1 BankTransfer, BRD §11 confirmed-2).
   */
  async getDropdown(invoiceId: string) {
    const rows = await this.dataSource.query(
      `
      SELECT
        bp.id,
        bp."paymentTotalAmount",
        bp."taxableAmount",
        bp."gstAmount",
        bp."tdsDeductionAmount",
        bp."bookingDate",
        bp."hasTransfer",
        bp."approvalStatus",
        -- eligibility: only one bank transfer per book payment
        CASE
          WHEN bp."hasTransfer" = true THEN false
          ELSE true
        END AS eligible,
        CASE
          WHEN bp."hasTransfer" = true
            THEN 'Bank transfer already created for this book payment (1:1 rule)'
          ELSE NULL
        END AS reason
      FROM book_payments bp
      WHERE bp."invoiceId" = $1
        AND bp."deletedAt" IS NULL
      ORDER BY bp."createdAt" DESC
      `,
      [invoiceId],
    );

    return {
      records: rows.map((r: any) => ({
        id: r.id,
        label: `₹${Number(r.paymentTotalAmount).toLocaleString('en-IN')} — ${r.bookingDate}`,
        eligible: r.eligible,
        reason: r.reason ?? null,
        meta: {
          paymentTotalAmount: Number(r.paymentTotalAmount),
          taxableAmount: Number(r.taxableAmount),
          gstAmount: Number(r.gstAmount),
          tdsDeductionAmount: Number(r.tdsDeductionAmount),
          bookingDate: r.bookingDate,
          hasTransfer: r.hasTransfer,
          approvalStatus: r.approvalStatus,
        },
      })),
    };
  }
}
