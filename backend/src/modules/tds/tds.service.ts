import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DataSource, IsNull, Equal, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { TdsRepository } from './tds.repository';
import { GetTdsRegisterDto, CreateTdsPaymentDto } from './dto';
import { TDS_ERRORS, TDS_RESPONSES } from './constants/tds.constants';
import {
  PartyType,
  FinancialApprovalStatus,
  getFinancialYear,
} from 'src/modules/common/financials/financial.constants';
import { DefaultPaginationValues, SortOrder } from 'src/utils/utility/constants/utility.constants';

@Injectable()
export class TdsService {
  constructor(
    private readonly tdsRepository: TdsRepository,
    private readonly dataSource: DataSource,
  ) {}

  async findAllRegisterEntries(query: GetTdsRegisterDto) {
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
      this.tdsRepository.findAllRegisterEntries({
        where,
        order: { [sortField]: sortOrder as SortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
        relations: ['invoice', 'site', 'site.company', 'contractor', 'vendor'],
      }),
      this.tdsRepository.countRegisterEntries({ where }),
    ]);

    return { records, totalRecords };
  }

  async findRegisterEntryById(id: string) {
    const entry = await this.tdsRepository.findOneRegisterEntry({
      where: { id, deletedAt: IsNull() },
      relations: ['invoice', 'site', 'site.company', 'contractor', 'vendor', 'verifiedByUser'],
    });
    if (!entry) throw new NotFoundException(TDS_ERRORS.ENTRY_NOT_FOUND);
    return {
      ...entry,
      verifiedByUser: entry.verifiedByUser
        ? {
            id: entry.verifiedByUser.id,
            firstName: entry.verifiedByUser.firstName,
            lastName: entry.verifiedByUser.lastName,
            email: entry.verifiedByUser.email,
            employeeId: entry.verifiedByUser.employeeId,
          }
        : null,
    };
  }

  /**
   * Verify a TDS register entry (both sides).
   */
  async verifyEntry(
    id: string,
    verifiedBy: string,
    dto?: { fileKey?: string; fileName?: string; remarks?: string },
  ) {
    const entry = await this.tdsRepository.findOneRegisterEntry({
      where: { id, deletedAt: IsNull() },
    });
    if (!entry) throw new NotFoundException(TDS_ERRORS.ENTRY_NOT_FOUND);

    if (entry.isVerified) {
      throw new ConflictException(TDS_ERRORS.ALREADY_VERIFIED);
    }

    await this.tdsRepository.updateRegisterEntry(
      { id, financialYear: entry.financialYear },
      {
        isVerified: true,
        verifiedAt: new Date(),
        verifiedBy,
        verifyFileKey: dto?.fileKey ?? null,
        verifyFileName: dto?.fileName ?? null,
        verifyRemarks: dto?.remarks ?? null,
        updatedBy: verifiedBy,
      },
    );

    return { message: TDS_RESPONSES.ENTRY_VERIFIED };
  }

  /**
   * Revert verification of a TDS register entry (blocked if payment released).
   */
  async revertEntry(id: string, revertedBy: string, reason: string) {
    const entry = await this.tdsRepository.findOneRegisterEntry({
      where: { id, deletedAt: IsNull() },
    });
    if (!entry) throw new NotFoundException(TDS_ERRORS.ENTRY_NOT_FOUND);

    if (!entry.isVerified) {
      throw new BadRequestException(TDS_ERRORS.NOT_VERIFIED);
    }
    if (entry.tdsPaymentId) {
      throw new BadRequestException(TDS_ERRORS.CANNOT_REVERT_PAYMENT_RELEASED);
    }

    await this.tdsRepository.updateRegisterEntry(
      { id, financialYear: entry.financialYear },
      {
        isVerified: false,
        verifiedAt: null,
        verifiedBy: null,
        revertReason: reason,
        updatedBy: revertedBy,
      },
    );

    return { message: TDS_RESPONSES.ENTRY_REVERTED };
  }

  /**
   * Release TDS payment — atomic across all verified-unpaid entries for the month.
   */
  async releasePayment(dto: CreateTdsPaymentDto, releasedBy: string) {
    // Validate party type requirements
    if (dto.partyType === PartyType.SALE && !dto.contractorId) {
      throw new BadRequestException(TDS_ERRORS.INVALID_PARTY_CONTRACTOR);
    }
    if (dto.partyType === PartyType.PURCHASE && !dto.vendorId) {
      throw new BadRequestException(TDS_ERRORS.INVALID_PARTY_VENDOR);
    }

    const partyId = dto.partyType === PartyType.SALE ? dto.contractorId : dto.vendorId;

    return await this.dataSource.transaction(async (em) => {
      // Check if payment already exists
      const existingWhere: any = {
        siteId: dto.siteId,
        partyType: dto.partyType,
        paymentMonth: dto.paymentMonth,
        deletedAt: IsNull(),
      };
      if (dto.partyType === PartyType.SALE) {
        existingWhere.contractorId = dto.contractorId;
      } else {
        existingWhere.vendorId = dto.vendorId;
      }

      const existing = await this.tdsRepository.findOnePayment({ where: existingWhere }, em);
      if (existing) {
        throw new ConflictException(TDS_ERRORS.PAYMENT_ALREADY_EXISTS);
      }

      // Get verified, unpaid entries
      const entries = await this.tdsRepository.getVerifiedUnpaidEntries(
        dto.siteId,
        dto.partyType,
        partyId,
        dto.paymentMonth,
        em,
      );
      if (entries.length === 0) {
        throw new BadRequestException(TDS_ERRORS.NO_VERIFIED_ENTRIES);
      }

      // Calculate net amount
      const netAmount = entries.reduce((sum, e) => sum + Number(e.tdsAmount), 0);

      const financialYear = getFinancialYear(dto.paymentDate);

      // Create payment
      const payment = await this.tdsRepository.createPayment(
        {
          siteId: dto.siteId,
          partyType: dto.partyType,
          contractorId: dto.partyType === PartyType.SALE ? dto.contractorId : null,
          vendorId: dto.partyType === PartyType.PURCHASE ? dto.vendorId : null,
          paymentMonth: dto.paymentMonth,
          financialYear,
          netAmount,
          utrNumber: dto.utrNumber,
          paymentDate: new Date(dto.paymentDate),
          fileKey: dto.fileKey ?? null,
          fileName: dto.fileName ?? null,
          remarks: dto.remarks ?? null,
          approvalStatus: FinancialApprovalStatus.APPROVED,
          createdBy: releasedBy,
        },
        em,
      );

      // Link all entries to this payment. Each entry already carries its own
      // financialYear so we include it in the WHERE clause — Postgres prunes
      // straight to the matching partition for each update.
      for (const entry of entries) {
        await this.tdsRepository.updateRegisterEntry(
          { id: entry.id, financialYear: entry.financialYear },
          { tdsPaymentId: payment.id, updatedBy: releasedBy },
          em,
        );
      }

      return {
        message: TDS_RESPONSES.PAYMENT_RELEASED,
        id: payment.id,
        netAmount,
        entriesCount: entries.length,
      };
    });
  }

  /**
   * Get TDS payments list.
   */
  async findAllPayments(siteId?: string, partyType?: PartyType) {
    const where: any = { deletedAt: IsNull() };
    if (siteId) where.siteId = siteId;
    if (partyType) where.partyType = partyType;

    return await this.tdsRepository.findAllPayments({
      where,
      order: { createdAt: 'DESC' },
      relations: ['site', 'site.company', 'contractor', 'vendor'],
    });
  }
}
