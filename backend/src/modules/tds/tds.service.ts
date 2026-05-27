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
        relations: [
          // PURCHASE: bookPayment → invoice → jmc → po
          'bookPayment',
          'bookPayment.invoice',
          'bookPayment.invoice.jmc',
          'bookPayment.invoice.jmc.po',
          // SALE: bankTransfer → invoice → jmc → po
          // PURCHASE: bankTransfer (bookPaymentId set; invoice already via bookPayment above)
          'bankTransfer',
          'bankTransfer.invoice',
          'bankTransfer.invoice.jmc',
          'bankTransfer.invoice.jmc.po',
          // Party & payment
          'site',
          'site.company',
          'contractor',
          'vendor',
          'tdsPayment',
        ],
      }),
      this.tdsRepository.countRegisterEntries({ where }),
    ]);

    return { records, totalRecords };
  }

  async findRegisterEntryById(id: string) {
    const entry = await this.tdsRepository.findOneRegisterEntry({
      where: { id, deletedAt: IsNull() },
      relations: [
        // PURCHASE: bookPayment → invoice → jmc → po
        'bookPayment',
        'bookPayment.invoice',
        'bookPayment.invoice.jmc',
        'bookPayment.invoice.jmc.po',
        // SALE: bankTransfer → invoice → jmc → po
        // PURCHASE: bankTransfer (bookPaymentId set; invoice already via bookPayment above)
        'bankTransfer',
        'bankTransfer.invoice',
        'bankTransfer.invoice.jmc',
        'bankTransfer.invoice.jmc.po',
        // Party, audit & payment
        'site',
        'site.company',
        'contractor',
        'vendor',
        'verifiedByUser',
        'tdsPayment',
      ],
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
   * Release TDS payment — entry-wise bulk selection.
   */
  async releasePayment(dto: CreateTdsPaymentDto, releasedBy: string) {
    return await this.dataSource.transaction(async (em) => {
      // Fetch all selected entries
      const entries = await this.tdsRepository.getEntriesByIds(dto.entryIds, em);

      if (entries.length === 0) {
        throw new BadRequestException(TDS_ERRORS.NO_VERIFIED_ENTRIES);
      }
      if (entries.length !== dto.entryIds.length) {
        throw new BadRequestException('One or more entries not found.');
      }

      // Validate all entries are verified and unpaid
      for (const entry of entries) {
        if (!entry.isVerified) {
          throw new BadRequestException(
            `Entry ${entry.id} is not verified. Verify all entries before releasing payment.`,
          );
        }
        if (entry.tdsPaymentId) {
          throw new BadRequestException(`Entry ${entry.id} is already linked to a payment.`);
        }
      }

      // All entries must share the same site, partyType, and party (contractor or vendor)
      const siteIds = [...new Set(entries.map((e) => e.siteId))];
      const partyTypes = [...new Set(entries.map((e) => e.partyType))];
      if (siteIds.length > 1 || partyTypes.length > 1) {
        throw new BadRequestException(
          'All selected entries must belong to the same site and party type.',
        );
      }
      const siteId = siteIds[0];
      const partyType = partyTypes[0] as PartyType;
      const contractorId = partyType === PartyType.SALE ? entries[0].contractorId : null;
      const vendorId = partyType === PartyType.PURCHASE ? entries[0].vendorId : null;
      const paymentMonth = entries[0].invoiceMonth;

      // Calculate net amount
      const netAmount = entries.reduce((sum, e) => sum + Number(e.tdsAmount), 0);

      const financialYear = getFinancialYear(dto.paymentDate);

      // Create payment
      const payment = await this.tdsRepository.createPayment(
        {
          siteId,
          partyType,
          contractorId,
          vendorId,
          paymentMonth,
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
