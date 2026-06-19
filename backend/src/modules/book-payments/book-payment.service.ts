import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource, IsNull, ILike, In, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { BookPaymentRepository } from './book-payment.repository';
import { BookPaymentEntity } from './entities/book-payment.entity';
import {
  CreateBookPaymentDto,
  UpdateBookPaymentDto,
  GetBookPaymentDto,
  GetVendorListQueryDto,
  VendorListResponseDto,
} from './dto';
import { buildVendorListQuery } from './queries/book-payment.queries';
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

      // Snapshot amounts from invoice (informational)
      const invoiceTaxable = Number(invoice.taxableAmount);
      const gstAmount = Number(invoice.gstAmount ?? 0);
      const gstPercentage = invoice.gstPercentage ?? null;

      // invoiceNetPayable: isGstHold=true → taxable−tds; isGstHold=false → taxable+gst−tds
      const invoiceNetPayable = invoice.isGstHold
        ? invoiceTaxable - Number(invoice.tdsAmount ?? 0)
        : invoiceTaxable + gstAmount - Number(invoice.tdsAmount ?? 0);

      // Ceiling: sum of existing book payments must not exceed invoiceNetPayable
      const existingBooked = await this.bookPaymentRepository.sumByInvoice(dto.invoiceId, em);
      const remaining = invoiceNetPayable - existingBooked;
      if (remaining <= 0) {
        throw new BadRequestException(BOOK_PAYMENT_ERRORS.INVOICE_CEILING_EXCEEDED);
      }

      const transferAmount = Number(dto.transferAmount);
      if (transferAmount > remaining) {
        throw new BadRequestException(BOOK_PAYMENT_ERRORS.INVOICE_CEILING_EXCEEDED);
      }

      // Each book payment books exactly what is transferred — no per-payment hold
      const paymentTotalAmount = transferAmount;

      // Create book payment — PENDING until approved
      const created = await this.bookPaymentRepository.create(
        {
          invoiceId: invoice.id,
          siteId: invoice.siteId,
          vendorId: invoice.vendorId,
          poId: invoice.poId,
          bookingDate: new Date(dto.bookingDate),
          taxableAmount: invoiceTaxable,
          gstAmount,
          gstPercentage,
          paymentTotalAmount,
          paymentHoldAmount: 0,
          paymentHoldReason: dto.paymentHoldReason ?? null,
          remarks: dto.remarks ?? null,
          approvalStatus: FinancialApprovalStatus.PENDING,
          approvalBy: null,
          approvalAt: null,
          hasTransfer: false,
          createdBy,
        },
        em,
      );

      // Increment invoice.bookedTotal and PO.bookedTotal by transferAmount
      await em
        .getRepository(SiteInvoiceEntity)
        .update({ id: invoice.id }, { bookedTotal: () => `"bookedTotal" + ${transferAmount}` });

      await this.purchaseOrderService.adjustRollups(
        invoice.poId,
        { bookedTotal: transferAmount },
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

      if (bp.approvalStatus === FinancialApprovalStatus.APPROVED) {
        throw new BadRequestException(BOOK_PAYMENT_ERRORS.CANNOT_EDIT_APPROVED);
      }
      if (bp.hasTransfer) {
        throw new BadRequestException(BOOK_PAYMENT_ERRORS.CANNOT_UPDATE_HAS_TRANSFER);
      }

      if (dto.transferAmount !== undefined) {
        const newTransferAmount = Number(dto.transferAmount);
        const oldTransferAmount = Number(bp.paymentTotalAmount);

        // Re-check ceiling: remove old amount, add new amount
        const invoice = await em
          .getRepository(SiteInvoiceEntity)
          .createQueryBuilder('inv')
          .setLock('pessimistic_write')
          .where('inv.id = :id', { id: bp.invoiceId })
          .andWhere('inv."deletedAt" IS NULL')
          .getOne();
        if (!invoice) throw new NotFoundException(BOOK_PAYMENT_ERRORS.INVOICE_NOT_FOUND);

        const invoiceTaxable = Number(invoice.taxableAmount);
        const invoiceNetPayable = invoice.isGstHold
          ? invoiceTaxable - Number(invoice.tdsAmount ?? 0)
          : invoiceTaxable + Number(invoice.gstAmount ?? 0) - Number(invoice.tdsAmount ?? 0);

        const existingBooked = await this.bookPaymentRepository.sumByInvoice(bp.invoiceId, em);
        const adjustedBooked = existingBooked - oldTransferAmount + newTransferAmount;
        if (adjustedBooked > invoiceNetPayable) {
          throw new BadRequestException(BOOK_PAYMENT_ERRORS.INVOICE_CEILING_EXCEEDED);
        }

        const delta = newTransferAmount - oldTransferAmount;
        if (delta !== 0) {
          await em
            .getRepository(SiteInvoiceEntity)
            .update({ id: bp.invoiceId }, { bookedTotal: () => `"bookedTotal" + ${delta}` });
          await this.purchaseOrderService.adjustRollups(bp.poId, { bookedTotal: delta }, em);
        }

        await this.bookPaymentRepository.update(
          { id },
          {
            paymentTotalAmount: newTransferAmount,
            paymentHoldReason:
              dto.paymentHoldReason !== undefined ? dto.paymentHoldReason : bp.paymentHoldReason,
            bookingDate: dto.bookingDate ? new Date(dto.bookingDate) : undefined,
            remarks: dto.remarks !== undefined ? dto.remarks : bp.remarks,
            updatedBy,
          } as Partial<BookPaymentEntity>,
          em,
        );
      } else {
        await this.bookPaymentRepository.update(
          { id },
          {
            paymentHoldReason:
              dto.paymentHoldReason !== undefined ? dto.paymentHoldReason : bp.paymentHoldReason,
            bookingDate: dto.bookingDate ? new Date(dto.bookingDate) : undefined,
            remarks: dto.remarks !== undefined ? dto.remarks : bp.remarks,
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

      if (bp.approvalStatus === FinancialApprovalStatus.APPROVED) {
        throw new BadRequestException(BOOK_PAYMENT_ERRORS.CANNOT_DELETE_APPROVED);
      }
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

  async approve(id: string, approvedBy: string) {
    const bp = await this.bookPaymentRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!bp) throw new NotFoundException(BOOK_PAYMENT_ERRORS.NOT_FOUND);
    if (bp.approvalStatus === FinancialApprovalStatus.APPROVED) {
      throw new BadRequestException(BOOK_PAYMENT_ERRORS.ALREADY_APPROVED);
    }
    await this.bookPaymentRepository.update({ id }, {
      approvalStatus: FinancialApprovalStatus.APPROVED,
      approvalBy: approvedBy,
      approvalAt: new Date(),
      updatedBy: approvedBy,
    } as Partial<BookPaymentEntity>);
    return { message: BOOK_PAYMENT_RESPONSES.APPROVED };
  }

  async reject(id: string, rejectedBy: string) {
    return await this.dataSource.transaction(async (em) => {
      const bp = await this.bookPaymentRepository.findOneForUpdate(id, em);
      if (!bp) throw new NotFoundException(BOOK_PAYMENT_ERRORS.NOT_FOUND);
      if (bp.approvalStatus === FinancialApprovalStatus.APPROVED) {
        throw new BadRequestException(BOOK_PAYMENT_ERRORS.CANNOT_REJECT_APPROVED);
      }

      // Reverse bookedTotal that was incremented on create
      const effectiveAmount = Number(bp.paymentTotalAmount);
      await em
        .getRepository(SiteInvoiceEntity)
        .update({ id: bp.invoiceId }, { bookedTotal: () => `"bookedTotal" - ${effectiveAmount}` });
      await this.purchaseOrderService.adjustRollups(bp.poId, { bookedTotal: -effectiveAmount }, em);

      await this.bookPaymentRepository.update(
        { id },
        {
          approvalStatus: FinancialApprovalStatus.REJECTED,
          approvalBy: rejectedBy,
          approvalAt: new Date(),
          updatedBy: rejectedBy,
        } as Partial<BookPaymentEntity>,
        em,
      );
      return { message: BOOK_PAYMENT_RESPONSES.REJECTED };
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

  async getVendorList(query: GetVendorListQueryDto): Promise<VendorListResponseDto> {
    const {
      countQuery,
      countParams,
      vendorIdsQuery,
      vendorIdsParams,
      detailQuery,
      summaryQuery,
      summaryParams,
    } = buildVendorListQuery(query);

    // Run count and summary in parallel with vendor-id pagination
    const [vendorIdRows, [{ total }], [summaryRow]] = await Promise.all([
      this.bookPaymentRepository.executeRawQuery(vendorIdsQuery, vendorIdsParams),
      this.bookPaymentRepository.executeRawQuery(countQuery, countParams),
      this.bookPaymentRepository.executeRawQuery(summaryQuery, summaryParams),
    ]);

    const totalRecords = Number(total);

    if (vendorIdRows.length === 0) {
      return {
        records: [],
        totalRecords,
        summary: {
          totalVendors: 0,
          totalBookPayments: 0,
          totalTaxableAmount: 0,
          totalGstAmount: 0,
          totalPaymentAmount: 0,
          totalHoldAmount: 0,
        },
      };
    }

    const pageVendorIds = vendorIdRows.map((r: any) => r.vendorId);

    // Fetch all book payment rows for the current vendor page in one query
    const rows: any[] = await this.bookPaymentRepository.executeRawQuery(detailQuery, [
      pageVendorIds,
    ]);

    // Group rows by vendorId
    const vendorMap = new Map<string, any[]>();
    for (const row of rows) {
      if (!vendorMap.has(row.vendorId)) vendorMap.set(row.vendorId, []);
      vendorMap.get(row.vendorId)?.push(row);
    }

    // Preserve the pagination order from vendorIdRows
    const records = pageVendorIds
      .filter((vid: string) => vendorMap.has(vid))
      .map((vid: string) => {
        const bpRows = vendorMap.get(vid) ?? [];
        const first = bpRows[0];

        const vendor = {
          id: first.vendorId,
          name: first.vendorName,
          city: first.vendorCity,
          state: first.vendorState,
          contactNumber: first.vendorContact,
          email: first.vendorEmail ?? null,
          bankDetails: {
            accountHolderName: first.vendorAccountHolderName ?? null,
            bankName: first.vendorBankName ?? null,
            accountNumber: first.vendorAccountNumber ?? null,
            ifscCode: first.vendorIfscCode ?? null,
          },
        };

        const bookPayments = bpRows.map((r) => {
          const displayName = [r.vendorName, r.siteName, r.companyName, r.siteCity, r.siteState]
            .filter(Boolean)
            .join(' | ');

          return {
            id: r.bpId,
            bookingDate: r.bookingDate,
            taxableAmount: Number(r.taxableAmount),
            gstAmount: Number(r.gstAmount),
            gstPercentage: r.gstPercentage !== null ? Number(r.gstPercentage) : null,
            paymentTotalAmount: Number(r.paymentTotalAmount),
            paymentHoldAmount: Number(r.paymentHoldAmount),
            paymentHoldReason: r.paymentHoldReason ?? null,
            remarks: r.remarks ?? null,
            approvalStatus: r.approvalStatus,
            hasTransfer: r.hasTransfer,
            displayName,
            invoice: {
              id: r.invoiceId,
              invoiceNumber: r.invoiceNumber ?? null,
              invoiceDate: r.invoiceDate ?? null,
              totalAmount: r.invoiceTotalAmount !== null ? Number(r.invoiceTotalAmount) : null,
              approvalStatus: r.invoiceApprovalStatus,
            },
            jmc: r.jmcId ? { id: r.jmcId, jmcNumber: r.jmcNumber, jmcDate: r.jmcDate } : null,
            po: r.poId
              ? {
                  id: r.poId,
                  poNumber: r.poNumber,
                  poDate: r.poDate,
                  totalAmount: Number(r.poTotalAmount),
                }
              : null,
            site: {
              id: r.siteId,
              name: r.siteName,
              city: r.siteCity ?? null,
              state: r.siteState ?? null,
            },
            company: {
              id: r.companyId,
              name: r.companyName,
            },
          };
        });

        const vendorSummary = {
          totalBookPayments: bookPayments.length,
          totalTaxableAmount: bookPayments.reduce((s, b) => s + b.taxableAmount, 0),
          totalGstAmount: bookPayments.reduce((s, b) => s + b.gstAmount, 0),
          totalPaymentAmount: bookPayments.reduce((s, b) => s + b.paymentTotalAmount, 0),
          totalHoldAmount: bookPayments.reduce((s, b) => s + b.paymentHoldAmount, 0),
        };

        return { vendor, vendorSummary, bookPayments };
      });

    return {
      records,
      totalRecords,
      summary: {
        totalVendors: Number(summaryRow?.totalVendors ?? 0),
        totalBookPayments: Number(summaryRow?.totalBookPayments ?? 0),
        totalTaxableAmount: Number(summaryRow?.totalTaxableAmount ?? 0),
        totalGstAmount: Number(summaryRow?.totalGstAmount ?? 0),
        totalPaymentAmount: Number(summaryRow?.totalPaymentAmount ?? 0),
        totalHoldAmount: Number(summaryRow?.totalHoldAmount ?? 0),
      },
    };
  }
}
