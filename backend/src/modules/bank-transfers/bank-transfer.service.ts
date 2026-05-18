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
   * SALE side: transfer linked to invoice, ceiling check Σ ≤ invoice total.
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

      // Ceiling check
      const existingPaid = await this.bankTransferRepository.sumByInvoice(dto.invoiceId, em);
      if (existingPaid + dto.transferAmount > Number(invoice.totalAmount)) {
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

      return { message: BANK_TRANSFER_RESPONSES.CREATED, id: created.id };
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

      // Exact amount match
      if (
        Number(dto.transferAmount.toFixed(2)) !== Number(Number(bp.paymentTotalAmount).toFixed(2))
      ) {
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

      // Fetch vendor + site details for PDF (outside the critical path — failures logged, not fatal)
      const [vendor, site] = await Promise.all([
        em.getRepository(VendorEntity).findOne({ where: { id: bp.vendorId } }),
        em.getRepository(SiteEntity).findOne({ where: { id: bp.siteId }, relations: ['company'] }),
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
          vendorBankName: vendor?.bankName ?? null,
          vendorAccountNumber: vendor?.accountNumber ?? null,
          vendorIfscCode: vendor?.ifscCode ?? null,
          vendorAccountHolderName: vendor?.accountHolderName ?? null,
          siteName: site?.name ?? 'Unknown',
          companyName: (site as any)?.company?.name ?? 'Eureka Enterprises',
          utrNumber: dto.utrNumber,
          transferDate: dto.transferDate,
          transferAmount: dto.transferAmount,
          taxableAmount: Number(bp.taxableAmount),
          gstAmount: Number(bp.gstAmount),
          tdsDeductionAmount: Number(bp.tdsDeductionAmount),
          paymentTotalAmount: Number(bp.paymentTotalAmount),
        },
      );

      return {
        message: BANK_TRANSFER_RESPONSES.CREATED,
        id: created.id,
        paymentAdviceId: advice.id,
        paymentAdviceReference: advice.referenceNumber,
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

      // Check if payment advice exists — block delete if so
      const adviceExists = await em.query(
        `SELECT 1 FROM payment_advices WHERE "bankTransferId" = $1 AND "deletedAt" IS NULL LIMIT 1`,
        [id],
      );
      if (adviceExists.length > 0 && dto.transferAmount !== undefined) {
        throw new BadRequestException(BANK_TRANSFER_ERRORS.CANNOT_CHANGE_AMOUNT_ADVICE_EXISTS);
      }

      // For PURCHASE side, amount is fixed (1:1 with book payment)
      if (bt.partyType === PartyType.PURCHASE && dto.transferAmount !== undefined) {
        throw new BadRequestException(BANK_TRANSFER_ERRORS.CANNOT_CHANGE_AMOUNT_PURCHASE);
      }

      // For SALE side, re-check ceiling if amount changed
      if (bt.partyType === PartyType.SALE && dto.transferAmount !== undefined) {
        const invoice = await em.getRepository(SiteInvoiceEntity).findOne({
          where: { id: bt.invoiceId, deletedAt: IsNull() },
        });
        if (!invoice) throw new NotFoundException(BANK_TRANSFER_ERRORS.INVOICE_NOT_FOUND);

        const existingPaid = await this.bankTransferRepository.sumByInvoice(bt.invoiceId, em);
        const adjustedPaid = existingPaid - Number(bt.transferAmount) + dto.transferAmount;
        if (adjustedPaid > Number(invoice.totalAmount)) {
          throw new BadRequestException(BANK_TRANSFER_ERRORS.INVOICE_CEILING_EXCEEDED);
        }

        // Adjust rollups
        const delta = dto.transferAmount - Number(bt.transferAmount);
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
      if (bt.partyType === PartyType.SALE && bt.invoiceId) {
        await em
          .getRepository(SiteInvoiceEntity)
          .update({ id: bt.invoiceId }, { paidTotal: () => `"paidTotal" - ${bt.transferAmount}` });
      } else if (bt.partyType === PartyType.PURCHASE && bt.bookPaymentId) {
        await this.bookPaymentService.markHasTransfer(bt.bookPaymentId, false, em);
        // Get invoice from book payment
        const bp = await em.getRepository(BookPaymentEntity).findOne({
          where: { id: bt.bookPaymentId },
        });
        if (bp) {
          await em
            .getRepository(SiteInvoiceEntity)
            .update(
              { id: bp.invoiceId },
              { paidTotal: () => `"paidTotal" - ${bt.transferAmount}` },
            );
        }
      }

      await this.purchaseOrderService.adjustRollups(
        bt.poId,
        { paidTotal: -Number(bt.transferAmount) },
        em,
      );

      await this.bankTransferRepository.update({ id }, { deletedBy }, em);
      await this.bankTransferRepository.softDelete({ id }, em);

      return { message: BANK_TRANSFER_RESPONSES.DELETED };
    });
  }
}
