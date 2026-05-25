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
        relations: ['invoice', 'site', 'site.company', 'contractor', 'vendor', 'gstPayment'],
      }),
      this.gstRepository.countRegisterEntries({ where }),
    ]);

    return { records, totalRecords };
  }

  async findRegisterEntryById(id: string) {
    const entry = await this.gstRepository.findOneRegisterEntry({
      where: { id, deletedAt: IsNull() },
      relations: [
        'invoice',
        'site',
        'site.company',
        'contractor',
        'vendor',
        'verifiedByUser',
        'gstPayment',
      ],
    });
    if (!entry) throw new NotFoundException(GST_ERRORS.ENTRY_NOT_FOUND);
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
   * Verify a GST register entry (both SALE and PURCHASE).
   */
  async verifyEntry(
    id: string,
    verifiedBy: string,
    dto?: { fileKey?: string; fileName?: string; remarks?: string },
  ) {
    const entry = await this.gstRepository.findOneRegisterEntry({
      where: { id, deletedAt: IsNull() },
    });
    if (!entry) throw new NotFoundException(GST_ERRORS.ENTRY_NOT_FOUND);

    if (entry.isVerified) {
      throw new ConflictException(GST_ERRORS.ALREADY_VERIFIED);
    }

    await this.gstRepository.updateRegisterEntry(
      { id },
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

    return { message: GST_RESPONSES.ENTRY_VERIFIED };
  }

  /**
   * Revert verification of a GST register entry (blocked if payment released).
   */
  async revertEntry(id: string, revertedBy: string, reason: string) {
    const entry = await this.gstRepository.findOneRegisterEntry({
      where: { id, deletedAt: IsNull() },
    });
    if (!entry) throw new NotFoundException(GST_ERRORS.ENTRY_NOT_FOUND);

    if (!entry.isVerified) {
      throw new BadRequestException(GST_ERRORS.NOT_VERIFIED);
    }
    if (entry.gstPaymentId) {
      throw new BadRequestException(GST_ERRORS.CANNOT_REVERT_PAYMENT_RELEASED);
    }

    await this.gstRepository.updateRegisterEntry(
      { id, financialYear: entry.financialYear },
      {
        isVerified: false,
        verifiedAt: null,
        verifiedBy: null,
        revertReason: reason,
        updatedBy: revertedBy,
      },
    );

    return { message: GST_RESPONSES.ENTRY_REVERTED };
  }

  /**
   * Release GST payment — entry-wise bulk selection.
   */
  async releasePayment(dto: CreateGstPaymentDto, releasedBy: string) {
    return await this.dataSource.transaction(async (em) => {
      // Fetch all selected entries
      const entries = await this.gstRepository.getEntriesByIds(dto.entryIds, em);

      if (entries.length === 0) {
        throw new BadRequestException(GST_ERRORS.NO_VERIFIED_ENTRIES);
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
        if (entry.gstPaymentId) {
          throw new BadRequestException(`Entry ${entry.id} is already linked to a payment.`);
        }
      }

      // All entries must share the same site and partyType
      const siteIds = [...new Set(entries.map((e) => e.siteId))];
      const partyTypes = [...new Set(entries.map((e) => e.partyType))];
      if (siteIds.length > 1 || partyTypes.length > 1) {
        throw new BadRequestException(
          'All selected entries must belong to the same site and party type.',
        );
      }
      const siteId = siteIds[0];
      const partyType = partyTypes[0] as PartyType;

      // Validate party consistency per side
      if (partyType === PartyType.PURCHASE) {
        const vendorIds = [...new Set(entries.map((e) => e.vendorId))];
        if (vendorIds.length > 1) {
          throw new BadRequestException(
            'All selected PURCHASE entries must belong to the same vendor.',
          );
        }
      } else {
        const contractorIds = [...new Set(entries.map((e) => e.contractorId))];
        if (contractorIds.length > 1) {
          throw new BadRequestException(
            'All selected SALE entries must belong to the same contractor.',
          );
        }
      }

      const contractorId = partyType === PartyType.SALE ? entries[0].contractorId : null;
      const vendorId = partyType === PartyType.PURCHASE ? entries[0].vendorId : null;

      // Use the first entry's invoiceMonth as paymentMonth for reference
      const paymentMonth = entries[0].invoiceMonth;

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
          paymentAdviceReferenceNumber: referenceNumber,
          approvalStatus: FinancialApprovalStatus.APPROVED,
          createdBy: releasedBy,
        },
        em,
      );

      // Link selected entries to this payment
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
  async findAllPayments(
    siteId?: string,
    vendorId?: string,
    partyType?: string,
    contractorId?: string,
  ) {
    const where: any = { deletedAt: IsNull() };
    if (siteId) where.siteId = siteId;
    if (vendorId) where.vendorId = vendorId;
    if (partyType) where.partyType = partyType;
    if (contractorId) where.contractorId = contractorId;

    return await this.gstRepository.findAllPayments({
      where,
      order: { createdAt: 'DESC' },
      relations: ['site', 'site.company', 'vendor', 'contractor'],
    });
  }
}
