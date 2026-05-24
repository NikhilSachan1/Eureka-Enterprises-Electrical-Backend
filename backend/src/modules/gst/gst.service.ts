import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DataSource, IsNull, Equal, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { GstRepository } from './gst.repository';
import { GetGstRegisterDto, CreateGstPaymentDto, GetGstSummaryDto } from './dto';
import { GST_ERRORS, GST_RESPONSES } from './constants/gst.constants';
import { GST_QUERIES } from './queries/gst.queries';
import {
  PartyType,
  FinancialApprovalStatus,
  getFinancialYear,
} from 'src/modules/common/financials/financial.constants';
import { DefaultPaginationValues, SortOrder } from 'src/utils/utility/constants/utility.constants';

@Injectable()
export class GstService {
  constructor(
    private readonly gstRepository: GstRepository,
    private readonly dataSource: DataSource,
  ) {}

  async findAllRegisterEntries(query: GetGstRegisterDto) {
    const {
      siteId,
      partyType,
      month,
      financialYear,
      vendorId,
      contractorId,
      isVerified,
      dateFrom,
      dateTo,
      sortField = DefaultPaginationValues.SORT_FIELD,
      sortOrder = DefaultPaginationValues.SORT_ORDER,
      page = DefaultPaginationValues.PAGE,
      pageSize = DefaultPaginationValues.PAGE_SIZE,
    } = query;

    const where: any = { deletedAt: IsNull() };
    if (siteId) where.siteId = siteId;
    if (partyType) where.partyType = partyType;
    if (month) where.invoiceMonth = month;
    if (financialYear) where.financialYear = financialYear;
    if (vendorId) where.vendorId = vendorId;
    if (contractorId) where.contractorId = contractorId;
    if (isVerified !== undefined) where.isVerified = Equal(isVerified === 'true');
    if (dateFrom && dateTo) where.invoice = { invoiceDate: Between(dateFrom, dateTo) };
    else if (dateFrom) where.invoice = { invoiceDate: MoreThanOrEqual(dateFrom) };
    else if (dateTo) where.invoice = { invoiceDate: LessThanOrEqual(dateTo) };

    const [records, totalRecords] = await Promise.all([
      this.gstRepository.findAllRegisterEntries({
        where,
        order: { [sortField]: sortOrder as SortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
        relations: ['invoice', 'site', 'site.company', 'contractor', 'vendor'],
      }),
      this.gstRepository.countRegisterEntries({ where }),
    ]);

    return { records, totalRecords };
  }

  async findRegisterEntryById(id: string) {
    const entry = await this.gstRepository.findOneRegisterEntry({
      where: { id, deletedAt: IsNull() },
      relations: ['invoice', 'site', 'site.company', 'contractor', 'vendor'],
    });
    if (!entry) throw new NotFoundException(GST_ERRORS.ENTRY_NOT_FOUND);
    return entry;
  }

  /**
   * Verify a GST register entry (PURCHASE side only).
   */
  async verifyEntry(id: string, verifiedBy: string) {
    const entry = await this.gstRepository.findOneRegisterEntry({
      where: { id, deletedAt: IsNull() },
    });
    if (!entry) throw new NotFoundException(GST_ERRORS.ENTRY_NOT_FOUND);

    if (entry.partyType !== PartyType.PURCHASE) {
      throw new BadRequestException(GST_ERRORS.CANNOT_VERIFY_SALE);
    }
    if (entry.isVerified) {
      throw new ConflictException(GST_ERRORS.ALREADY_VERIFIED);
    }

    await this.gstRepository.updateRegisterEntry(
      { id },
      {
        isVerified: true,
        verifiedAt: new Date(),
        verifiedBy,
        updatedBy: verifiedBy,
      },
    );

    return { message: GST_RESPONSES.ENTRY_VERIFIED };
  }

  /**
   * Revert verification of a GST register entry (blocked if payment released).
   */
  async revertEntry(id: string, revertedBy: string) {
    const entry = await this.gstRepository.findOneRegisterEntry({
      where: { id, deletedAt: IsNull() },
    });
    if (!entry) throw new NotFoundException(GST_ERRORS.ENTRY_NOT_FOUND);

    if (entry.partyType !== PartyType.PURCHASE) {
      throw new BadRequestException(GST_ERRORS.CANNOT_VERIFY_SALE);
    }
    if (!entry.isVerified) {
      throw new BadRequestException(GST_ERRORS.NOT_VERIFIED);
    }
    if (entry.gstPaymentId) {
      throw new BadRequestException(GST_ERRORS.CANNOT_REVERT_PAYMENT_RELEASED);
    }

    // Pin to the row's partition for partition pruning.
    await this.gstRepository.updateRegisterEntry(
      { id, financialYear: entry.financialYear },
      {
        isVerified: false,
        verifiedAt: null,
        verifiedBy: null,
        updatedBy: revertedBy,
      },
    );

    return { message: GST_RESPONSES.ENTRY_REVERTED };
  }

  /**
   * Release GST payment — atomic across all verified-unpaid entries for the month.
   */
  async releasePayment(dto: CreateGstPaymentDto, releasedBy: string) {
    return await this.dataSource.transaction(async (em) => {
      // Check if payment already exists
      const existing = await this.gstRepository.findOnePayment(
        {
          where: {
            siteId: dto.siteId,
            vendorId: dto.vendorId,
            paymentMonth: dto.paymentMonth,
            deletedAt: IsNull(),
          },
        },
        em,
      );
      if (existing) {
        throw new ConflictException(GST_ERRORS.PAYMENT_ALREADY_EXISTS);
      }

      // Get verified, unpaid entries
      const entries = await this.gstRepository.getVerifiedUnpaidEntries(
        dto.siteId,
        dto.vendorId,
        dto.paymentMonth,
        em,
      );
      if (entries.length === 0) {
        throw new BadRequestException(GST_ERRORS.NO_VERIFIED_ENTRIES);
      }

      // Calculate net amount
      const netAmount = entries.reduce((sum, e) => sum + Number(e.gstAmount), 0);

      // Get financial year and allocate sequence
      const financialYear = getFinancialYear(dto.paymentDate);
      const { referenceNumber } = await this.gstRepository.allocateGstPaymentSequence(
        financialYear,
        em,
      );

      // Create payment
      const payment = await this.gstRepository.createPayment(
        {
          siteId: dto.siteId,
          vendorId: dto.vendorId,
          paymentMonth: dto.paymentMonth,
          financialYear,
          netAmount,
          utrNumber: dto.utrNumber,
          paymentDate: new Date(dto.paymentDate),
          fileKey: dto.fileKey ?? null,
          fileName: dto.fileName ?? null,
          remarks: dto.remarks ?? null,
          paymentAdviceReferenceNumber: referenceNumber,
          approvalStatus: FinancialApprovalStatus.APPROVED,
          createdBy: releasedBy,
        },
        em,
      );

      // Link all entries to this payment. Each entry already carries its own
      // financialYear so we include it in the WHERE clause — Postgres prunes
      // straight to the matching partition for each update.
      for (const entry of entries) {
        await this.gstRepository.updateRegisterEntry(
          { id: entry.id, financialYear: entry.financialYear },
          { gstPaymentId: payment.id, updatedBy: releasedBy },
          em,
        );
      }

      return {
        message: GST_RESPONSES.PAYMENT_RELEASED,
        id: payment.id,
        referenceNumber,
        netAmount,
        entriesCount: entries.length,
      };
    });
  }

  /**
   * Get GST summary per BRD §5.3.
   */
  async getSummary(query: GetGstSummaryDto) {
    const { siteId, financialYear } = query;
    const fy = financialYear ?? getFinancialYear();

    const result = await this.dataSource.query(GST_QUERIES.GST_SUMMARY, [siteId, fy]);

    return { siteId, financialYear: fy, summary: result };
  }

  /**
   * Get GST payments list.
   */
  async findAllPayments(siteId?: string, vendorId?: string) {
    const where: any = { deletedAt: IsNull() };
    if (siteId) where.siteId = siteId;
    if (vendorId) where.vendorId = vendorId;

    return await this.gstRepository.findAllPayments({
      where,
      order: { createdAt: 'DESC' },
      relations: ['site', 'site.company', 'vendor'],
    });
  }
}
