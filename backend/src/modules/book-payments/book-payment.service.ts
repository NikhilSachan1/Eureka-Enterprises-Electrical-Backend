import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource, IsNull, ILike, In, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { BookPaymentRepository } from './book-payment.repository';
import { BookPaymentEntity } from './entities/book-payment.entity';
import { CreateBookPaymentDto, UpdateBookPaymentDto, GetBookPaymentDto } from './dto';
import { BOOK_PAYMENT_ERRORS, BOOK_PAYMENT_RESPONSES } from './constants/book-payment.constants';
import { SiteInvoiceEntity } from 'src/modules/site-invoices/entities/site-invoice.entity';
import { PurchaseOrderService } from 'src/modules/purchase-orders/purchase-order.service';
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

      this.validateAmounts(
        dto.taxableAmount,
        dto.gstAmount ?? 0,
        dto.tdsDeductionAmount ?? 0,
        dto.paymentTotalAmount,
      );

      // Ceiling check: sum of booked + new ≤ invoice total
      const existingBooked = await this.bookPaymentRepository.sumByInvoice(dto.invoiceId, em);
      const newTotal = existingBooked + dto.paymentTotalAmount;
      if (newTotal > Number(invoice.totalAmount)) {
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
          gstAmount: dto.gstAmount ?? 0,
          gstPercentage: dto.gstPercentage ?? null,
          tdsDeductionAmount: dto.tdsDeductionAmount ?? 0,
          tdsPercentage: dto.tdsPercentage ?? null,
          paymentTotalAmount: dto.paymentTotalAmount,
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
        .update(
          { id: invoice.id },
          { bookedTotal: () => `"bookedTotal" + ${dto.paymentTotalAmount}` },
        );

      await this.purchaseOrderService.adjustRollups(
        invoice.poId,
        { bookedTotal: dto.paymentTotalAmount },
        em,
      );

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

    const [records, totalRecords] = await Promise.all([
      this.bookPaymentRepository.findAll({
        where,
        order: { [sortField]: sortOrder as SortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
        relations: ['invoice', 'site', 'site.company', 'vendor'],
      }),
      this.bookPaymentRepository.count({ where }),
    ]);

    return { records, totalRecords };
  }

  async findById(id: string) {
    const bp = await this.bookPaymentRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ['invoice', 'site', 'site.company', 'vendor'],
    });
    if (!bp) throw new NotFoundException(BOOK_PAYMENT_ERRORS.NOT_FOUND);
    return bp;
  }

  async update(id: string, dto: UpdateBookPaymentDto, updatedBy: string) {
    return await this.dataSource.transaction(async (em) => {
      const bp = await this.bookPaymentRepository.findOneForUpdate(id, em);
      if (!bp) throw new NotFoundException(BOOK_PAYMENT_ERRORS.NOT_FOUND);

      if (bp.hasTransfer) {
        throw new BadRequestException(BOOK_PAYMENT_ERRORS.CANNOT_UPDATE_HAS_TRANSFER);
      }

      // UpdateBookPaymentDto omits @Type(() => Number); absent fields stay
      // undefined under enableImplicitConversion so ?? fallback is safe.
      const newTaxable = dto.taxableAmount ?? Number(bp.taxableAmount);
      const newGst = dto.gstAmount ?? Number(bp.gstAmount);
      const newTds = dto.tdsDeductionAmount ?? Number(bp.tdsDeductionAmount);
      const newTotal = dto.paymentTotalAmount ?? Number(bp.paymentTotalAmount);
      this.validateAmounts(newTaxable, newGst, newTds, newTotal);

      // Re-check ceiling if amount changed.
      // Lock the invoice row alongside the BP row so two concurrent BP updates
      // on the same invoice serialize their ceiling checks. Without the lock
      // each update reads `existingBooked` independently and they could each
      // pass the check while their combined effect breaches the invoice total.
      if (dto.paymentTotalAmount !== undefined) {
        const invoice = await em
          .getRepository(SiteInvoiceEntity)
          .createQueryBuilder('inv')
          .setLock('pessimistic_write')
          .where('inv.id = :id', { id: bp.invoiceId })
          .andWhere('inv."deletedAt" IS NULL')
          .getOne();
        if (!invoice) throw new NotFoundException(BOOK_PAYMENT_ERRORS.INVOICE_NOT_FOUND);

        const existingBooked = await this.bookPaymentRepository.sumByInvoice(bp.invoiceId, em);
        const adjustedBooked = existingBooked - Number(bp.paymentTotalAmount) + newTotal;
        if (adjustedBooked > Number(invoice.totalAmount)) {
          throw new BadRequestException(BOOK_PAYMENT_ERRORS.INVOICE_CEILING_EXCEEDED);
        }

        // Adjust rollups
        const delta = newTotal - Number(bp.paymentTotalAmount);
        if (delta !== 0) {
          await em
            .getRepository(SiteInvoiceEntity)
            .update({ id: bp.invoiceId }, { bookedTotal: () => `"bookedTotal" + ${delta}` });
          await this.purchaseOrderService.adjustRollups(bp.poId, { bookedTotal: delta }, em);
        }
      }

      await this.bookPaymentRepository.update(
        { id },
        {
          ...dto,
          bookingDate: dto.bookingDate ? new Date(dto.bookingDate) : undefined,
          updatedBy,
        } as Partial<BookPaymentEntity>,
        em,
      );

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

  private validateAmounts(taxable: number, gst: number, tds: number, total: number): void {
    const expected = Number((taxable + gst - tds).toFixed(2));
    const got = Number(total.toFixed(2));
    if (expected !== got) {
      throw new BadRequestException(BOOK_PAYMENT_ERRORS.AMOUNT_VALIDATION_FAILED);
    }
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
