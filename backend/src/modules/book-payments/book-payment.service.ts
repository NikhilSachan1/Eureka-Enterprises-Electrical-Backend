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
  FINANCIAL_ERRORS,
} from 'src/modules/common/financials/financial.constants';
import { DefaultPaginationValues, SortOrder } from 'src/utils/utility/constants/utility.constants';
import { UnlockRequestDto } from 'src/modules/purchase-orders/dto/approval.dto';

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

      // Auto-approved + auto-locked on creation.
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
          approvalStatus: FinancialApprovalStatus.APPROVED,
          approvalBy: createdBy,
          approvalAt: new Date(),
          isLocked: true,
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
          'unlockRequestedByUser',
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
        unlockRequestedByUser: formatUser(bp.unlockRequestedByUser),
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
        'unlockRequestedByUser',
      ],
    });
    if (!bp) throw new NotFoundException(BOOK_PAYMENT_ERRORS.NOT_FOUND);
    return {
      ...bp,
      createdByUser: formatUser(bp.createdByUser),
      updatedByUser: formatUser(bp.updatedByUser),
      approvalByUser: formatUser(bp.approvalByUser),
      unlockRequestedByUser: formatUser(bp.unlockRequestedByUser),
    };
  }

  async update(id: string, dto: UpdateBookPaymentDto, updatedBy: string) {
    return await this.dataSource.transaction(async (em) => {
      const bp = await this.bookPaymentRepository.findOneForUpdate(id, em);
      if (!bp) throw new NotFoundException(BOOK_PAYMENT_ERRORS.NOT_FOUND);

      // Must be unlocked first (via the unlock workflow) before it can be edited.
      if (bp.isLocked) {
        throw new BadRequestException(FINANCIAL_ERRORS.CANNOT_EDIT_LOCKED);
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
            // Editing re-approves + re-locks (book payments are always auto-approved + locked).
            approvalStatus: FinancialApprovalStatus.APPROVED,
            approvalBy: updatedBy,
            approvalAt: new Date(),
            isLocked: true,
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
            approvalStatus: FinancialApprovalStatus.APPROVED,
            approvalBy: updatedBy,
            approvalAt: new Date(),
            isLocked: true,
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

      // Must be unlocked first (via the unlock workflow) before it can be deleted.
      if (bp.isLocked) {
        throw new BadRequestException(FINANCIAL_ERRORS.CANNOT_EDIT_LOCKED);
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

  // ── Unlock workflow (JMC-style) ───────────────────────────────────────────

  async requestUnlock(id: string, dto: UnlockRequestDto, requestedBy: string) {
    const bp = await this.findActiveById(id);
    if (bp.hasTransfer) {
      throw new BadRequestException(BOOK_PAYMENT_ERRORS.CANNOT_UNLOCK_HAS_TRANSFER);
    }
    if (!bp.isLocked || bp.approvalStatus !== FinancialApprovalStatus.APPROVED) {
      throw new BadRequestException(BOOK_PAYMENT_ERRORS.ONLY_APPROVED_LOCKED_CAN_REQUEST_UNLOCK);
    }
    await this.bookPaymentRepository.update({ id }, {
      unlockRequestedAt: new Date(),
      unlockRequestedBy: requestedBy,
      unlockReason: dto.reason,
      updatedBy: requestedBy,
    } as Partial<BookPaymentEntity>);
    return { message: BOOK_PAYMENT_RESPONSES.UNLOCK_REQUESTED };
  }

  async grantUnlock(id: string, grantedBy: string) {
    const bp = await this.findActiveById(id);
    if (!bp.unlockRequestedAt) {
      throw new BadRequestException(FINANCIAL_ERRORS.UNLOCK_NOT_REQUESTED);
    }
    // A transfer must never exist here (blocked at request time), but re-check defensively.
    if (bp.hasTransfer) {
      throw new BadRequestException(BOOK_PAYMENT_ERRORS.CANNOT_UNLOCK_HAS_TRANSFER);
    }
    // NOTE: bookedTotal is intentionally NOT reversed — it is tied to the row existing
    // (added at create, reversed only on reject/delete), not to approval state. The
    // booking stays live through APPROVED→PENDING; a subsequent edit re-adjusts by delta.
    await this.bookPaymentRepository.update({ id }, {
      approvalStatus: FinancialApprovalStatus.PENDING,
      approvalBy: null,
      approvalAt: null,
      isLocked: false,
      unlockRequestedAt: null,
      unlockRequestedBy: null,
      unlockReason: null,
      updatedBy: grantedBy,
    } as Partial<BookPaymentEntity>);
    return { message: BOOK_PAYMENT_RESPONSES.UNLOCK_GRANTED };
  }

  async rejectUnlock(id: string, rejectedBy: string) {
    const bp = await this.findActiveById(id);
    if (!bp.unlockRequestedAt) {
      throw new BadRequestException(FINANCIAL_ERRORS.UNLOCK_REJECT_NO_REQUEST);
    }
    await this.bookPaymentRepository.update({ id }, {
      unlockRequestedAt: null,
      unlockRequestedBy: null,
      unlockReason: null,
      updatedBy: rejectedBy,
    } as Partial<BookPaymentEntity>);
    return { message: BOOK_PAYMENT_RESPONSES.UNLOCK_REJECTED };
  }

  private async findActiveById(id: string): Promise<BookPaymentEntity> {
    const bp = await this.bookPaymentRepository.findOne({ where: { id, deletedAt: IsNull() } });
    if (!bp) throw new NotFoundException(BOOK_PAYMENT_ERRORS.NOT_FOUND);
    return bp;
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
      bookPaymentDetailQuery,
      unbookedInvoiceDetailQuery,
      bookPaymentSummaryQuery,
      bookPaymentSummaryParams,
      unbookedInvoiceSummaryQuery,
      unbookedInvoiceSummaryParams,
    } = buildVendorListQuery(query);

    const [vendorIdRows, [{ total }], [bpSummaryRow], [invSummaryRow]] = await Promise.all([
      this.bookPaymentRepository.executeRawQuery(vendorIdsQuery, vendorIdsParams),
      this.bookPaymentRepository.executeRawQuery(countQuery, countParams),
      this.bookPaymentRepository.executeRawQuery(bookPaymentSummaryQuery, bookPaymentSummaryParams),
      this.bookPaymentRepository.executeRawQuery(
        unbookedInvoiceSummaryQuery,
        unbookedInvoiceSummaryParams,
      ),
    ]);

    const totalRecords = Number(total);

    const summary = {
      totalVendors: totalRecords,
      totalBookPayments: Number(bpSummaryRow?.totalBookPayments ?? 0),
      totalTaxableAmount: Number(bpSummaryRow?.totalTaxableAmount ?? 0),
      totalGstAmount: Number(bpSummaryRow?.totalGstAmount ?? 0),
      totalTdsAmount: Number(bpSummaryRow?.totalTdsAmount ?? 0),
      totalNetPayableAmount: Number(bpSummaryRow?.totalNetPayableAmount ?? 0),
      totalPaymentAmount: Number(bpSummaryRow?.totalPaymentAmount ?? 0),
      totalHoldAmount: Number(bpSummaryRow?.totalHoldAmount ?? 0),
      totalUnbookedInvoices: Number(invSummaryRow?.totalUnbookedInvoices ?? 0),
      totalPendingToBook: Number(invSummaryRow?.totalPendingToBook ?? 0),
    };

    if (vendorIdRows.length === 0) {
      return { records: [], totalRecords, summary };
    }

    const pageVendorIds = vendorIdRows.map((r: any) => r.vendorId);

    // Pull this page's book payments and un-booked invoices in parallel.
    const [bpRows, invRows]: [any[], any[]] = await Promise.all([
      this.bookPaymentRepository.executeRawQuery(bookPaymentDetailQuery, [pageVendorIds]),
      this.bookPaymentRepository.executeRawQuery(unbookedInvoiceDetailQuery, [pageVendorIds]),
    ]);

    const bpMap = new Map<string, any[]>();
    for (const row of bpRows) {
      if (!bpMap.has(row.vendorId)) bpMap.set(row.vendorId, []);
      bpMap.get(row.vendorId)?.push(row);
    }
    const invMap = new Map<string, any[]>();
    for (const row of invRows) {
      if (!invMap.has(row.vendorId)) invMap.set(row.vendorId, []);
      invMap.get(row.vendorId)?.push(row);
    }

    const vendorFrom = (r: any) => ({
      id: r.vendorId,
      name: r.vendorName,
      city: r.vendorCity,
      state: r.vendorState,
      contactNumber: r.vendorContact,
      email: r.vendorEmail ?? null,
      bankDetails: {
        accountHolderName: r.vendorAccountHolderName ?? null,
        bankName: r.vendorBankName ?? null,
        accountNumber: r.vendorAccountNumber ?? null,
        ifscCode: r.vendorIfscCode ?? null,
      },
    });
    const displayNameOf = (r: any) =>
      [r.vendorName, r.siteName, r.companyName, r.siteCity, r.siteState]
        .filter(Boolean)
        .join(' | ');

    const records = pageVendorIds
      .filter((vid: string) => bpMap.has(vid) || invMap.has(vid))
      .map((vid: string) => {
        const bpVendorRows = bpMap.get(vid) ?? [];
        const invVendorRows = invMap.get(vid) ?? [];
        const vendor = vendorFrom(bpVendorRows[0] ?? invVendorRows[0]);

        const bookPayments = bpVendorRows.map((r) => {
          const tdsAmount = r.invoiceTdsAmount !== null ? Number(r.invoiceTdsAmount) : 0;
          const isGstHold: boolean = r.invoiceIsGstHold;
          const netPayableAmount = isGstHold
            ? Number(r.taxableAmount) - tdsAmount
            : Number(r.taxableAmount) + Number(r.gstAmount) - tdsAmount;
          return {
            id: r.bpId,
            bookingDate: r.bookingDate,
            taxableAmount: Number(r.taxableAmount),
            gstAmount: Number(r.gstAmount),
            gstPercentage: r.gstPercentage !== null ? Number(r.gstPercentage) : null,
            tdsAmount,
            isGstHold,
            netPayableAmount,
            paymentTotalAmount: Number(r.paymentTotalAmount),
            paymentHoldAmount: Number(r.paymentHoldAmount),
            paymentHoldReason: r.paymentHoldReason ?? null,
            remarks: r.remarks ?? null,
            approvalStatus: r.approvalStatus,
            hasTransfer: r.hasTransfer,
            displayName: displayNameOf(r),
            invoice: {
              id: r.invoiceId,
              invoiceNumber: r.invoiceNumber ?? null,
              invoiceDate: r.invoiceDate ?? null,
              totalAmount: r.invoiceTotalAmount !== null ? Number(r.invoiceTotalAmount) : null,
              taxableAmount:
                r.invoiceTaxableAmount !== null ? Number(r.invoiceTaxableAmount) : null,
              gstAmount: r.invoiceGstAmount !== null ? Number(r.invoiceGstAmount) : null,
              gstPercentage:
                r.invoiceGstPercentage !== null ? Number(r.invoiceGstPercentage) : null,
              tdsAmount: r.invoiceTdsAmount !== null ? Number(r.invoiceTdsAmount) : null,
              isGstHold: r.invoiceIsGstHold,
              netPayableAmount:
                r.invoiceNetPayableAmount !== null ? Number(r.invoiceNetPayableAmount) : null,
              bookedTotal: r.invoiceBookedTotal !== null ? Number(r.invoiceBookedTotal) : null,
              pendingToBook:
                r.invoicePendingToBook !== null ? Number(r.invoicePendingToBook) : null,
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
            company: { id: r.companyId, name: r.companyName },
          };
        });

        const unbookedInvoices = invVendorRows.map((r) => ({
          id: r.invoiceId,
          invoiceNumber: r.invoiceNumber ?? null,
          invoiceDate: r.invoiceDate ?? null,
          taxableAmount: Number(r.taxableAmount ?? 0),
          gstAmount: Number(r.gstAmount ?? 0),
          gstPercentage: r.gstPercentage !== null ? Number(r.gstPercentage) : null,
          tdsAmount: Number(r.tdsAmount ?? 0),
          isGstHold: r.isGstHold,
          netPayableAmount: Number(r.netPayableAmount ?? 0),
          bookedTotal: Number(r.bookedTotal ?? 0),
          pendingToBook: Number(r.pendingToBook ?? 0),
          totalAmount: r.invoiceTotalAmount !== null ? Number(r.invoiceTotalAmount) : null,
          approvalStatus: r.invoiceApprovalStatus,
          displayName: displayNameOf(r),
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
          company: { id: r.companyId, name: r.companyName },
        }));

        const vendorSummary = {
          totalBookPayments: bookPayments.length,
          totalTaxableAmount: bookPayments.reduce((s, b) => s + b.taxableAmount, 0),
          totalGstAmount: bookPayments.reduce((s, b) => s + b.gstAmount, 0),
          totalTdsAmount: bookPayments.reduce((s, b) => s + b.tdsAmount, 0),
          totalNetPayableAmount: bookPayments.reduce((s, b) => s + b.netPayableAmount, 0),
          totalPaymentAmount: bookPayments.reduce((s, b) => s + b.paymentTotalAmount, 0),
          totalHoldAmount: bookPayments.reduce((s, b) => s + b.paymentHoldAmount, 0),
          totalUnbookedInvoices: unbookedInvoices.length,
          totalPendingToBook: unbookedInvoices.reduce((s, i) => s + i.pendingToBook, 0),
        };

        return { vendor, vendorSummary, bookPayments, unbookedInvoices };
      });

    return { records, totalRecords, summary };
  }
}
