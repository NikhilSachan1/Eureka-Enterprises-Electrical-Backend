import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DataSource, IsNull, ILike, In, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { BankTransferRepository } from './bank-transfer.repository';
import { BankTransferEntity } from './entities/bank-transfer.entity';
import { CreateBankTransferDto, UpdateBankTransferDto, GetBankTransferDto } from './dto';
import { BANK_TRANSFER_ERRORS, BANK_TRANSFER_RESPONSES } from './constants/bank-transfer.constants';
import { formatUser } from 'src/modules/common/financials/user-format.helper';
import { SiteInvoiceEntity } from 'src/modules/site-invoices/entities/site-invoice.entity';
import { BookPaymentEntity } from 'src/modules/book-payments/entities/book-payment.entity';
import { BookPaymentService } from 'src/modules/book-payments/book-payment.service';
import { PurchaseOrderService } from 'src/modules/purchase-orders/purchase-order.service';
import { PurchaseOrderEntity } from 'src/modules/purchase-orders/entities/purchase-order.entity';
import {
  PartyType,
  FinancialApprovalStatus,
  getFinancialYear,
} from 'src/modules/common/financials/financial.constants';
import { DefaultPaginationValues, SortOrder } from 'src/utils/utility/constants/utility.constants';
import { PaymentAdviceService } from 'src/modules/payment-advices/payment-advice.service';
import { VendorEntity } from 'src/modules/vendors/entities/vendor.entity';
import { SiteEntity } from 'src/modules/sites/entities/site.entity';

@Injectable()
export class BankTransferService {
  constructor(
    private readonly bankTransferRepository: BankTransferRepository,
    private readonly bookPaymentService: BookPaymentService,
    private readonly purchaseOrderService: PurchaseOrderService,
    private readonly paymentAdviceService: PaymentAdviceService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create a bank transfer. For PURCHASE side, auto-generates a payment advice.
   */
  async create(dto: CreateBankTransferDto, createdBy: string) {
    // Validate party type constraints
    if (dto.partyType === PartyType.SALE) {
      if (!dto.invoiceId || dto.bookPaymentId) {
        throw new BadRequestException(BANK_TRANSFER_ERRORS.INVALID_PARTY_SALE);
      }
      return this.createSaleTransfer(dto, createdBy);
    } else {
      if (!dto.bookPaymentId || dto.invoiceId) {
        throw new BadRequestException(BANK_TRANSFER_ERRORS.INVALID_PARTY_PURCHASE);
      }
      return this.createPurchaseTransfer(dto, createdBy);
    }
  }

  /**
   * SALE side: transfer linked to invoice, ceiling check Σ(transferAmount) ≤ invoice.taxableAmount − invoice.tdsAmount.
   * GST is excluded — tracked in the GST register and settled separately.
   * TDS is captured at invoice level (invoice.tdsAmount) — not tracked per transfer.
   */
  private async createSaleTransfer(dto: CreateBankTransferDto, createdBy: string) {
    return await this.dataSource.transaction(async (em) => {
      // Lock invoice
      const invoice = await em
        .getRepository(SiteInvoiceEntity)
        .createQueryBuilder('inv')
        .setLock('pessimistic_write')
        .where('inv.id = :id', { id: dto.invoiceId })
        .andWhere('inv."deletedAt" IS NULL')
        .getOne();

      if (!invoice) throw new NotFoundException(BANK_TRANSFER_ERRORS.INVOICE_NOT_FOUND);
      if (invoice.partyType !== PartyType.SALE) {
        throw new BadRequestException(BANK_TRANSFER_ERRORS.INVOICE_NOT_SALE_SIDE);
      }
      if (invoice.approvalStatus !== FinancialApprovalStatus.APPROVED) {
        throw new BadRequestException(BANK_TRANSFER_ERRORS.INVOICE_NOT_APPROVED);
      }

      // Ceiling: isGstHold=true → taxable−tds; isGstHold=false → taxable+gst−tds
      const invoiceNetPayable = invoice.isGstHold
        ? Number(invoice.taxableAmount) - Number(invoice.tdsAmount ?? 0)
        : Number(invoice.taxableAmount) +
          Number(invoice.gstAmount ?? 0) -
          Number(invoice.tdsAmount ?? 0);
      const existingPaid = await this.bankTransferRepository.sumByInvoice(dto.invoiceId, em);
      if (existingPaid + dto.transferAmount > invoiceNetPayable) {
        throw new BadRequestException(BANK_TRANSFER_ERRORS.INVOICE_CEILING_EXCEEDED);
      }

      const financialYear = getFinancialYear(dto.transferDate);

      const created = await this.bankTransferRepository.create(
        {
          partyType: PartyType.SALE,
          invoiceId: dto.invoiceId,
          bookPaymentId: null,
          siteId: invoice.siteId,
          contractorId: invoice.contractorId,
          vendorId: null,
          poId: invoice.poId,
          utrNumber: dto.utrNumber,
          transferDate: new Date(dto.transferDate),
          transferAmount: dto.transferAmount,
          financialYear,
          proofFileKey: dto.proofFileKey ?? null,
          proofFileName: dto.proofFileName ?? null,
          remarks: dto.remarks ?? null,
          approvalStatus: FinancialApprovalStatus.APPROVED,
          approvalBy: createdBy,
          approvalAt: new Date(),
          createdBy,
        },
        em,
      );

      // Update invoice paidTotal + PO paidTotal
      await em
        .getRepository(SiteInvoiceEntity)
        .update({ id: invoice.id }, { paidTotal: () => `"paidTotal" + ${dto.transferAmount}` });
      await this.purchaseOrderService.adjustRollups(
        invoice.poId,
        { paidTotal: dto.transferAmount, lastPaymentAt: new Date() },
        em,
      );

      return {
        message: BANK_TRANSFER_RESPONSES.CREATED,
        id: created.id,
        tdsNote: BANK_TRANSFER_RESPONSES.TDS_AT_INVOICE,
      };
    });
  }

  /**
   * PURCHASE side: transfer linked to book payment (1:1), exact amount match.
   * Auto-generates a payment advice in the same transaction.
   */
  private async createPurchaseTransfer(dto: CreateBankTransferDto, createdBy: string) {
    return await this.dataSource.transaction(async (em) => {
      // Lock book payment
      const bp = await this.bookPaymentService.findOneForUpdate(dto.bookPaymentId, em);
      if (!bp) throw new NotFoundException(BANK_TRANSFER_ERRORS.BOOK_PAYMENT_NOT_FOUND);

      // Check 1:1 constraint
      const existsTransfer = await this.bankTransferRepository.existsByBookPaymentId(
        dto.bookPaymentId,
        em,
      );
      if (existsTransfer) {
        throw new ConflictException(BANK_TRANSFER_ERRORS.BOOK_PAYMENT_HAS_TRANSFER);
      }

      // transferAmount must equal paymentTotalAmount − paymentHoldAmount
      const expectedTransfer = Number(
        (Number(bp.paymentTotalAmount) - Number(bp.paymentHoldAmount ?? 0)).toFixed(2),
      );
      if (Number(dto.transferAmount.toFixed(2)) !== expectedTransfer) {
        throw new BadRequestException(BANK_TRANSFER_ERRORS.AMOUNT_MISMATCH_PURCHASE);
      }

      const financialYear = getFinancialYear(dto.transferDate);

      const created = await this.bankTransferRepository.create(
        {
          partyType: PartyType.PURCHASE,
          invoiceId: null,
          bookPaymentId: dto.bookPaymentId,
          siteId: bp.siteId,
          contractorId: null,
          vendorId: bp.vendorId,
          poId: bp.poId,
          utrNumber: dto.utrNumber,
          transferDate: new Date(dto.transferDate),
          transferAmount: dto.transferAmount,
          financialYear,
          proofFileKey: dto.proofFileKey ?? null,
          proofFileName: dto.proofFileName ?? null,
          remarks: dto.remarks ?? null,
          approvalStatus: FinancialApprovalStatus.APPROVED,
          approvalBy: createdBy,
          approvalAt: new Date(),
          createdBy,
        },
        em,
      );

      // Mark book payment as having a transfer
      await this.bookPaymentService.markHasTransfer(bp.id, true, em);

      // Get invoice for paidTotal rollup
      const invoice = await em.getRepository(SiteInvoiceEntity).findOne({
        where: { id: bp.invoiceId, deletedAt: IsNull() },
      });
      if (invoice) {
        await em
          .getRepository(SiteInvoiceEntity)
          .update({ id: invoice.id }, { paidTotal: () => `"paidTotal" + ${dto.transferAmount}` });
      }

      // Update PO paidTotal
      await this.purchaseOrderService.adjustRollups(
        bp.poId,
        { paidTotal: dto.transferAmount, lastPaymentAt: new Date() },
        em,
      );

      // Fetch vendor, site, invoice, and PO details for PDF
      const [vendor, site, invoiceForPdf, poForPdf] = await Promise.all([
        em.getRepository(VendorEntity).findOne({ where: { id: bp.vendorId } }),
        em.getRepository(SiteEntity).findOne({ where: { id: bp.siteId }, relations: ['company'] }),
        em
          .getRepository(SiteInvoiceEntity)
          .findOne({ where: { id: bp.invoiceId, deletedAt: IsNull() } }),
        em.getRepository(PurchaseOrderEntity).findOne({ where: { id: bp.poId } }),
      ]);

      // Auto-generate payment advice (§5.1.9)
      const advice = await this.paymentAdviceService.createForBankTransfer(
        created.id,
        created.siteId,
        created.vendorId,
        financialYear,
        createdBy,
        em,
        {
          vendorName: vendor?.name ?? 'Unknown',
          vendorEmail: vendor?.email ?? '',
          vendorGstNumber: vendor?.gstNumber ?? null,
          vendorAddress: vendor?.fullAddress ?? null,
          vendorCity: vendor?.city ?? null,
          vendorBankName: vendor?.bankName ?? null,
          vendorAccountNumber: vendor?.accountNumber ?? null,
          vendorIfscCode: vendor?.ifscCode ?? null,
          vendorAccountHolderName: vendor?.accountHolderName ?? null,
          siteName: site?.name ?? 'Unknown',
          companyName: (site as any)?.company?.name ?? 'Eureka Enterprises',
          companyLogoKey: (site as any)?.company?.logo ?? null,
          companyAddress: (site as any)?.company?.fullAddress ?? null,
          companyGstNumber: (site as any)?.company?.gstNumber ?? null,
          utrNumber: dto.utrNumber,
          transferDate: dto.transferDate,
          transferAmount: dto.transferAmount,
          taxableAmount: Number(bp.taxableAmount),
          gstAmount: Number(bp.gstAmount),
          tdsDeductionAmount: Number(invoiceForPdf?.tdsAmount ?? 0),
          paymentTotalAmount: Number(bp.paymentTotalAmount),
          gstHoldAmount: invoiceForPdf?.isGstHold ? Number(invoiceForPdf.gstAmount) : 0,
          paymentHoldAmount: Number(bp.paymentHoldAmount ?? 0),
          paymentHoldReason: bp.paymentHoldReason ?? null,
          invoiceTaxableAmount: Number(invoiceForPdf?.taxableAmount ?? 0),
          invoiceGstAmount: Number(invoiceForPdf?.gstAmount ?? 0),
          invoiceTdsAmount: Number(invoiceForPdf?.tdsAmount ?? 0),
          invoicePaidTotal: Number(invoiceForPdf?.paidTotal ?? 0),
          invoiceNumber: invoiceForPdf?.invoiceNumber ?? null,
          invoiceDate: invoiceForPdf?.invoiceDate
            ? String(invoiceForPdf.invoiceDate).split('T')[0]
            : null,
          poNumber: poForPdf?.poNumber ?? null,
        },
      );

      return {
        message: BANK_TRANSFER_RESPONSES.CREATED,
        id: created.id,
        paymentAdviceId: advice.id,
        paymentAdviceReference: advice.referenceNumber,
        pdfNote: BANK_TRANSFER_RESPONSES.PDF_GENERATING,
      };
    });
  }

  async findAll(query: GetBankTransferDto) {
    const {
      companyId,
      siteId,
      partyType,
      invoiceId,
      bookPaymentId,
      contractorId,
      vendorId,
      financialYear,
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
    if (companyId?.length) where.site = { companyId: In(companyId) };
    if (siteId?.length) where.siteId = In(siteId);
    if (partyType) where.partyType = partyType;
    if (invoiceId) where.invoiceId = invoiceId;
    if (bookPaymentId) where.bookPaymentId = bookPaymentId;
    if (contractorId?.length) where.contractorId = In(contractorId);
    if (vendorId?.length) where.vendorId = In(vendorId);
    if (financialYear) where.financialYear = financialYear;
    if (dateFrom && dateTo) where.transferDate = Between(dateFrom, dateTo);
    else if (dateFrom) where.transferDate = MoreThanOrEqual(dateFrom);
    else if (dateTo) where.transferDate = LessThanOrEqual(dateTo);
    if (search) where.utrNumber = ILike(`%${search}%`);
    if (invoiceNumber || poNumber) {
      const invCond: any = {};
      if (invoiceNumber) invCond.invoiceNumber = ILike(`%${invoiceNumber}%`);
      if (poNumber) invCond.jmc = { po: { poNumber: ILike(`%${poNumber}%`) } };
      where.invoice = invCond;
    }

    const [records, totalRecords] = await Promise.all([
      this.bankTransferRepository.findAll({
        where,
        order: { [sortField]: sortOrder as SortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
        relations: [
          'invoice',
          'invoice.jmc',
          'invoice.jmc.po',
          'bookPayment',
          'bookPayment.invoice',
          'bookPayment.invoice.jmc',
          'bookPayment.invoice.jmc.po',
          'site',
          'site.company',
          'contractor',
          'vendor',
          'paymentAdvice',
          'createdByUser',
          'updatedByUser',
          'approvalByUser',
        ],
      }),
      this.bankTransferRepository.count({ where }),
    ]);

    return {
      records: records.map((bt) => ({
        ...bt,
        createdByUser: formatUser(bt.createdByUser),
        updatedByUser: formatUser(bt.updatedByUser),
        approvalByUser: formatUser(bt.approvalByUser),
      })),
      totalRecords,
    };
  }

  async findById(id: string) {
    const bt = await this.bankTransferRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: [
        'invoice',
        'invoice.jmc',
        'invoice.jmc.po',
        'bookPayment',
        'bookPayment.invoice',
        'bookPayment.invoice.jmc',
        'bookPayment.invoice.jmc.po',
        'site',
        'site.company',
        'contractor',
        'vendor',
        'paymentAdvice',
        'createdByUser',
        'updatedByUser',
        'approvalByUser',
      ],
    });
    if (!bt) throw new NotFoundException(BANK_TRANSFER_ERRORS.NOT_FOUND);
    return {
      ...bt,
      createdByUser: formatUser(bt.createdByUser),
      updatedByUser: formatUser(bt.updatedByUser),
      approvalByUser: formatUser(bt.approvalByUser),
    };
  }

  async update(id: string, dto: UpdateBankTransferDto, updatedBy: string) {
    return await this.dataSource.transaction(async (em) => {
      const bt = await this.bankTransferRepository.findOne(
        { where: { id, deletedAt: IsNull() } },
        em,
      );
      if (!bt) throw new NotFoundException(BANK_TRANSFER_ERRORS.NOT_FOUND);

      // PURCHASE side: amount is fixed (1:1 with book payment — must equal paymentTotalAmount)
      if (bt.partyType === PartyType.PURCHASE && dto.transferAmount !== undefined) {
        throw new BadRequestException(BANK_TRANSFER_ERRORS.CANNOT_CHANGE_AMOUNT_PURCHASE);
      }

      // SALE side: re-check ceiling if transferAmount changed
      if (bt.partyType === PartyType.SALE && dto.transferAmount !== undefined) {
        const invoice = await em.getRepository(SiteInvoiceEntity).findOne({
          where: { id: bt.invoiceId, deletedAt: IsNull() },
        });
        if (!invoice) throw new NotFoundException(BANK_TRANSFER_ERRORS.INVOICE_NOT_FOUND);

        const oldTransfer = Number(bt.transferAmount);
        const newTransfer = dto.transferAmount;
        // Ceiling: isGstHold=true → taxable−tds; isGstHold=false → taxable+gst−tds
        const invoiceNetPayable = invoice.isGstHold
          ? Number(invoice.taxableAmount) - Number(invoice.tdsAmount ?? 0)
          : Number(invoice.taxableAmount) +
            Number(invoice.gstAmount ?? 0) -
            Number(invoice.tdsAmount ?? 0);

        const existingPaid = await this.bankTransferRepository.sumByInvoice(bt.invoiceId, em);
        const adjustedPaid = existingPaid - oldTransfer + newTransfer;
        if (adjustedPaid > invoiceNetPayable) {
          throw new BadRequestException(BANK_TRANSFER_ERRORS.INVOICE_CEILING_EXCEEDED);
        }

        const delta = newTransfer - oldTransfer;
        if (delta !== 0) {
          await em
            .getRepository(SiteInvoiceEntity)
            .update({ id: bt.invoiceId }, { paidTotal: () => `"paidTotal" + ${delta}` });
          await this.purchaseOrderService.adjustRollups(bt.poId, { paidTotal: delta }, em);
        }
      }

      await this.bankTransferRepository.update(
        { id },
        {
          ...dto,
          transferDate: dto.transferDate ? new Date(dto.transferDate) : undefined,
          updatedBy,
        } as Partial<BankTransferEntity>,
        em,
      );

      // Regenerate PDF if any field shown on the advice changed
      const pdfAffected =
        dto.utrNumber !== undefined ||
        dto.transferDate !== undefined ||
        dto.transferAmount !== undefined;
      if (pdfAffected && bt.partyType === PartyType.PURCHASE) {
        const [vendor, site, bp] = await Promise.all([
          em.getRepository(VendorEntity).findOne({ where: { id: bt.vendorId } }),
          em
            .getRepository(SiteEntity)
            .findOne({ where: { id: bt.siteId }, relations: ['company'] }),
          bt.bookPaymentId
            ? em.getRepository(BookPaymentEntity).findOne({ where: { id: bt.bookPaymentId } })
            : Promise.resolve(null),
        ]);

        // Fetch invoice + PO for reference numbers and invoice-level TDS
        const [invoiceForPdf, poForPdf] = await Promise.all([
          bp?.invoiceId
            ? em
                .getRepository(SiteInvoiceEntity)
                .findOne({ where: { id: bp.invoiceId, deletedAt: IsNull() } })
            : Promise.resolve(null),
          bp?.poId
            ? em.getRepository(PurchaseOrderEntity).findOne({ where: { id: bp.poId } })
            : Promise.resolve(null),
        ]);

        this.paymentAdviceService.regeneratePdfAsync(id, {
          referenceNumber: '', // overridden inside regeneratePdfAsync
          generatedAt: new Date(),
          financialYear: bt.financialYear,
          vendorName: vendor?.name ?? 'Unknown',
          vendorEmail: vendor?.email ?? '',
          vendorGstNumber: vendor?.gstNumber ?? null,
          vendorAddress: vendor?.fullAddress ?? null,
          vendorCity: vendor?.city ?? null,
          vendorBankName: vendor?.bankName ?? null,
          vendorAccountNumber: vendor?.accountNumber ?? null,
          vendorIfscCode: vendor?.ifscCode ?? null,
          vendorAccountHolderName: vendor?.accountHolderName ?? null,
          siteName: site?.name ?? 'Unknown',
          companyName: (site as any)?.company?.name ?? 'Eureka Enterprises',
          companyLogoKey: (site as any)?.company?.logo ?? null,
          companyAddress: (site as any)?.company?.fullAddress ?? null,
          companyGstNumber: (site as any)?.company?.gstNumber ?? null,
          utrNumber: dto.utrNumber ?? bt.utrNumber,
          transferDate: dto.transferDate ?? String(bt.transferDate).split('T')[0],
          transferAmount: dto.transferAmount ?? Number(bt.transferAmount),
          taxableAmount: bp ? Number(bp.taxableAmount) : 0,
          gstAmount: bp ? Number(bp.gstAmount) : 0,
          tdsDeductionAmount: invoiceForPdf ? Number(invoiceForPdf.tdsAmount) : 0,
          paymentTotalAmount: bp ? Number(bp.paymentTotalAmount) : 0,
          gstHoldAmount: invoiceForPdf?.isGstHold ? Number(invoiceForPdf.gstAmount) : 0,
          paymentHoldAmount: bp ? Number(bp.paymentHoldAmount ?? 0) : 0,
          paymentHoldReason: bp?.paymentHoldReason ?? null,
          invoiceTaxableAmount: invoiceForPdf ? Number(invoiceForPdf.taxableAmount) : 0,
          invoiceGstAmount: invoiceForPdf ? Number(invoiceForPdf.gstAmount) : 0,
          invoiceTdsAmount: invoiceForPdf ? Number(invoiceForPdf.tdsAmount) : 0,
          invoicePaidTotal: invoiceForPdf ? Number(invoiceForPdf.paidTotal) : 0,
          invoiceNumber: invoiceForPdf?.invoiceNumber ?? null,
          invoiceDate: invoiceForPdf?.invoiceDate
            ? String(invoiceForPdf.invoiceDate).split('T')[0]
            : null,
          poNumber: poForPdf?.poNumber ?? null,
        });
      }

      return { message: BANK_TRANSFER_RESPONSES.UPDATED };
    });
  }

  async remove(id: string, deletedBy: string) {
    return await this.dataSource.transaction(async (em) => {
      const bt = await this.bankTransferRepository.findOne(
        { where: { id, deletedAt: IsNull() } },
        em,
      );
      if (!bt) throw new NotFoundException(BANK_TRANSFER_ERRORS.NOT_FOUND);

      // Cascade soft-delete payment advice if it exists
      await em.query(
        `UPDATE payment_advices SET "deletedAt" = NOW(), "deletedBy" = $2
         WHERE "bankTransferId" = $1 AND "deletedAt" IS NULL`,
        [id, deletedBy],
      );

      // Reverse rollups
      const poRollbackAmount = Number(bt.transferAmount);

      if (bt.partyType === PartyType.SALE && bt.invoiceId) {
        await em
          .getRepository(SiteInvoiceEntity)
          .update({ id: bt.invoiceId }, { paidTotal: () => `"paidTotal" - ${poRollbackAmount}` });
      } else if (bt.partyType === PartyType.PURCHASE && bt.bookPaymentId) {
        await this.bookPaymentService.markHasTransfer(bt.bookPaymentId, false, em);
        // Get invoice from book payment
        const bp = await em.getRepository(BookPaymentEntity).findOne({
          where: { id: bt.bookPaymentId },
        });
        if (bp) {
          await em
            .getRepository(SiteInvoiceEntity)
            .update({ id: bp.invoiceId }, { paidTotal: () => `"paidTotal" - ${poRollbackAmount}` });
        }
      }

      await this.purchaseOrderService.adjustRollups(bt.poId, { paidTotal: -poRollbackAmount }, em);

      await this.bankTransferRepository.update({ id }, { deletedBy }, em);
      await this.bankTransferRepository.softDelete({ id }, em);

      return { message: BANK_TRANSFER_RESPONSES.DELETED };
    });
  }
}
