import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource, IsNull, ILike, In, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { BookPaymentRepository } from './book-payment.repository';
import { BookPaymentEntity } from './entities/book-payment.entity';
import { CreateBookPaymentDto, UpdateBookPaymentDto, GetBookPaymentDto } from './dto';
import { BOOK_PAYMENT_ERRORS, BOOK_PAYMENT_RESPONSES } from './constants/book-payment.constants';
import { formatUser } from 'src/modules/common/financials/user-format.helper';
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
   * to enforce the ceiling check (Σ booked ≤ invoice net payable).
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

      // TDS is captured at invoice level — paymentTotalAmount is the exact cash amount to the vendor.
      const paymentTotalAmount = dto.taxableAmount;

      // Ceiling check: Σ(paymentTotalAmount) ≤ invoice.taxableAmount − invoice.tdsAmount
      const invoiceNetPayable = Number(invoice.taxableAmount) - Number(invoice.tdsAmount ?? 0);
      const existingBooked = await this.bookPaymentRepository.sumByInvoice(dto.invoiceId, em);
      if (existingBooked + paymentTotalAmount > invoiceNetPayable) {
        throw new BadRequestException(BOOK_PAYMENT_ERRORS.INVOICE_CEILING_EXCEEDED);
      }

      // Payment hold validation
      const paymentHoldAmount = Number(dto.paymentHoldAmount ?? 0);
      if (paymentHoldAmount > 0 && !dto.paymentHoldReason) {
        throw new BadRequestException(BOOK_PAYMENT_ERRORS.PAYMENT_HOLD_REASON_REQUIRED);
      }
      if (paymentHoldAmount >= paymentTotalAmount) {
        throw new BadRequestException(BOOK_PAYMENT_ERRORS.PAYMENT_HOLD_EXCEEDS_TOTAL);
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
          paymentTotalAmount,
          paymentHoldAmount,
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

      const amountsChanged = dto.taxableAmount !== undefined || dto.gstAmount !== undefined;

      if (amountsChanged) {
        const invoice = await em
          .getRepository(SiteInvoiceEntity)
          .createQueryBuilder('inv')
          .setLock('pessimistic_write')
          .where('inv.id = :id', { id: bp.invoiceId })
          .andWhere('inv."deletedAt" IS NULL')
          .getOne();
        if (!invoice) throw new NotFoundException(BOOK_PAYMENT_ERRORS.INVOICE_NOT_FOUND);

        const newTaxable = dto.taxableAmount ?? Number(bp.taxableAmount);
        const newPaymentTotal = newTaxable;

        const oldPaymentTotal = Number(bp.paymentTotalAmount);
        const invoiceNetPayable = Number(invoice.taxableAmount) - Number(invoice.tdsAmount ?? 0);

        const existingBooked = await this.bookPaymentRepository.sumByInvoice(bp.invoiceId, em);
        const adjustedBooked = existingBooked - oldPaymentTotal + newPaymentTotal;
        if (adjustedBooked > invoiceNetPayable) {
          throw new BadRequestException(BOOK_PAYMENT_ERRORS.INVOICE_CEILING_EXCEEDED);
        }

        const delta = newPaymentTotal - oldPaymentTotal;
        if (delta !== 0) {
          await em
            .getRepository(SiteInvoiceEntity)
            .update({ id: bp.invoiceId }, { bookedTotal: () => `"bookedTotal" + ${delta}` });
          await this.purchaseOrderService.adjustRollups(bp.poId, { bookedTotal: delta }, em);
        }

        // Payment hold validations against updated amounts
        const newPaymentHoldAmount =
          dto.paymentHoldAmount !== undefined
            ? Number(dto.paymentHoldAmount)
            : Number(bp.paymentHoldAmount);
        const newPaymentHoldReason =
          dto.paymentHoldReason !== undefined ? dto.paymentHoldReason : bp.paymentHoldReason;

        if (newPaymentHoldAmount > 0 && !newPaymentHoldReason) {
          throw new BadRequestException(BOOK_PAYMENT_ERRORS.PAYMENT_HOLD_REASON_REQUIRED);
        }
        if (newPaymentHoldAmount >= newPaymentTotal) {
          throw new BadRequestException(BOOK_PAYMENT_ERRORS.PAYMENT_HOLD_EXCEEDS_TOTAL);
        }

        const { taxableAmount, gstAmount, ...restDto } = dto;
        await this.bookPaymentRepository.update(
          { id },
          {
            ...restDto,
            ...(taxableAmount !== undefined && { taxableAmount }),
            ...(gstAmount !== undefined && { gstAmount }),
            paymentTotalAmount: newPaymentTotal,
            bookingDate: dto.bookingDate ? new Date(dto.bookingDate) : undefined,
            updatedBy,
          } as Partial<BookPaymentEntity>,
          em,
        );
      } else {
        // Payment hold validations for non-amount updates
        const newPaymentHoldAmount =
          dto.paymentHoldAmount !== undefined
            ? Number(dto.paymentHoldAmount)
            : Number(bp.paymentHoldAmount);
        const newPaymentHoldReason =
          dto.paymentHoldReason !== undefined ? dto.paymentHoldReason : bp.paymentHoldReason;

        if (newPaymentHoldAmount > 0 && !newPaymentHoldReason) {
          throw new BadRequestException(BOOK_PAYMENT_ERRORS.PAYMENT_HOLD_REASON_REQUIRED);
        }
        if (newPaymentHoldAmount >= Number(bp.paymentTotalAmount)) {
          throw new BadRequestException(BOOK_PAYMENT_ERRORS.PAYMENT_HOLD_EXCEEDS_TOTAL);
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

      // Reverse the booked amount that was added at create time
      const effectiveAmount = Number(bp.paymentTotalAmount);
      await em
        .getRepository(SiteInvoiceEntity)
        .update({ id: bp.invoiceId }, { bookedTotal: () => `"bookedTotal" - ${effectiveAmount}` });
      await this.purchaseOrderService.adjustRollups(bp.poId, { bookedTotal: -effectiveAmount }, em);

      await this.bookPaymentRepository.update({ id }, { deletedBy }, em);
      await this.bookPaymentRepository.softDelete({ id }, em);

      return { message: BOOK_PAYMENT_RESPONSES.DELETED };
    });
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
   */
  async getDropdown(invoiceId: string) {
    const rows = await this.dataSource.query(
      `
      SELECT
        bp.id,
        bp."paymentTotalAmount",
        bp."taxableAmount",
        bp."gstAmount",
        bp."paymentHoldAmount",
        to_char(bp."bookingDate", 'YYYY-MM-DD') AS "bookingDate",
        bp."hasTransfer",
        bp."approvalStatus",
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
        label: `₹${Number(r.paymentTotalAmount).toLocaleString('en-IN')} — ${
          r.bookingDate ? r.bookingDate.split('-').reverse().join('/') : ''
        }`,
        eligible: r.eligible,
        reason: r.reason ?? null,
        meta: {
          paymentTotalAmount: Number(r.paymentTotalAmount),
          taxableAmount: Number(r.taxableAmount),
          gstAmount: Number(r.gstAmount),
          paymentHoldAmount: Number(r.paymentHoldAmount ?? 0),
          expectedTransferAmount: Number(r.paymentTotalAmount) - Number(r.paymentHoldAmount ?? 0),
          bookingDate: r.bookingDate,
          hasTransfer: r.hasTransfer,
          approvalStatus: r.approvalStatus,
        },
      })),
    };
  }
}
