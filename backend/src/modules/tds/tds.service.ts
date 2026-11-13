import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DataSource, IsNull, Not, Equal, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { TdsRepository } from './tds.repository';
import { GetTdsRegisterDto, CreateTdsPaymentDto } from './dto';
import { TDS_ERRORS, TDS_RESPONSES } from './constants/tds.constants';
import {
  PartyType,
  FinancialApprovalStatus,
  getFinancialYear,
} from 'src/modules/common/financials/financial.constants';
import { DefaultPaginationValues, SortOrder } from 'src/utils/utility/constants/utility.constants';

/**
 * TDS register — how TDS actually moves:
 *
 *  PURCHASE (we are the deductor):
 *    1. We deduct TDS from the vendor's payment (entry created at invoice approval).
 *    2. We deposit it with the government via challan (identified by its UTR) — one challan can
 *       cover several vendors.
 *    3. We verify once it is filed in our 26Q / Form 16A is issued. Needs the challan first.
 *
 *  SALE (the client is the deductor):
 *    The client deposits the TDS; we only verify that it is credited in our Form 26AS.
 *    There is no challan on our side.
 */
@Injectable()
export class TdsService {
  constructor(
    private readonly tdsRepository: TdsRepository,
    private readonly dataSource: DataSource,
  ) {}

  private static readonly ENTRY_RELATIONS = [
    // Invoice-level entries (current model): invoice → jmc → po
    'invoice',
    'invoice.jmc',
    'invoice.jmc.po',
    // Legacy entries projected from book payments / bank transfers
    'bookPayment',
    'bookPayment.invoice',
    'bookPayment.invoice.jmc',
    'bookPayment.invoice.jmc.po',
    'bankTransfer',
    'bankTransfer.invoice',
    'bankTransfer.invoice.jmc',
    'bankTransfer.invoice.jmc.po',
    // Party & challan
    'site',
    'site.company',
    'contractor',
    'vendor',
    'tdsPayment',
  ];

  async findAllRegisterEntries(query: GetTdsRegisterDto) {
    const {
      siteId,
      partyType,
      month,
      financialYear,
      vendorId,
      contractorId,
      isVerified,
      challanStatus,
      dateFrom,
      dateTo,
      sortField = DefaultPaginationValues.SORT_FIELD,
      sortOrder = DefaultPaginationValues.SORT_ORDER,
      page = DefaultPaginationValues.PAGE,
      pageSize = DefaultPaginationValues.PAGE_SIZE,
    } = query;

    // Only vendor TDS goes on a challan; contractor TDS is deposited by the client. A challan
    // filter that contradicts the party filter matches nothing.
    const challanSide =
      challanStatus === 'NOT_APPLICABLE'
        ? PartyType.SALE
        : challanStatus
        ? PartyType.PURCHASE
        : undefined;
    if (challanSide && partyType && partyType !== challanSide) {
      return { records: [], totalRecords: 0 };
    }

    const where: any = { deletedAt: IsNull() };
    if (siteId) where.siteId = siteId;
    if (partyType) where.partyType = partyType;
    if (challanSide) where.partyType = challanSide;
    if (challanStatus === 'PENDING') where.tdsPaymentId = IsNull();
    if (challanStatus === 'DEPOSITED') where.tdsPaymentId = Not(IsNull());
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
        relations: TdsService.ENTRY_RELATIONS,
      }),
      this.tdsRepository.countRegisterEntries({ where }),
    ]);

    return { records, totalRecords };
  }

  async findRegisterEntryById(id: string) {
    const entry = await this.tdsRepository.findOneRegisterEntry({
      where: { id, deletedAt: IsNull() },
      relations: [...TdsService.ENTRY_RELATIONS, 'verifiedByUser'],
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
   * Verify a TDS entry.
   *   PURCHASE → filed in our 26Q (challan must already be recorded).
   *   SALE     → credit visible in our Form 26AS.
   */
  async verifyEntry(
    id: string,
    verifiedBy: string,
    dto?: { fileKey?: string; fileName?: string; remarks?: string },
  ) {
    const entry = await this.tdsRepository.findOneRegisterEntry({
      where: { id, deletedAt: IsNull() },
      relations: ['invoice'],
    });
    if (!entry) throw new NotFoundException(TDS_ERRORS.ENTRY_NOT_FOUND);

    if (entry.isVerified) {
      throw new ConflictException(TDS_ERRORS.ALREADY_VERIFIED);
    }
    if (entry.partyType === PartyType.PURCHASE && !entry.tdsPaymentId) {
      throw new BadRequestException(
        TDS_ERRORS.CHALLAN_REQUIRED_BEFORE_VERIFY(entry.invoice?.invoiceNumber ?? entry.invoiceId),
      );
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
        revertReason: null,
        updatedBy: verifiedBy,
      },
    );

    return { message: TDS_RESPONSES.ENTRY_VERIFIED };
  }

  /**
   * Revert verification. The challan (if any) stays — money already deposited is not undone,
   * only the 26Q / 26AS confirmation is.
   */
  async revertEntry(id: string, revertedBy: string, reason: string) {
    const entry = await this.tdsRepository.findOneRegisterEntry({
      where: { id, deletedAt: IsNull() },
    });
    if (!entry) throw new NotFoundException(TDS_ERRORS.ENTRY_NOT_FOUND);

    if (!entry.isVerified) {
      throw new BadRequestException(TDS_ERRORS.NOT_VERIFIED);
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
   * Record a TDS challan deposited with the government (PURCHASE only), all-or-nothing.
   * One challan may cover several vendors of the same site.
   */
  async releasePayment(dto: CreateTdsPaymentDto, releasedBy: string) {
    return await this.dataSource.transaction(async (em) => {
      const entries = await this.tdsRepository.getEntriesByIds(dto.entryIds, em);

      if (entries.length === 0) {
        throw new BadRequestException(TDS_ERRORS.NO_ENTRIES);
      }
      if (entries.length !== dto.entryIds.length) {
        throw new BadRequestException(TDS_ERRORS.ENTRIES_NOT_FOUND);
      }
      if (entries.some((e) => e.partyType !== PartyType.PURCHASE)) {
        throw new BadRequestException(TDS_ERRORS.SALE_HAS_NO_CHALLAN);
      }
      const siteIds = [...new Set(entries.map((e) => e.siteId))];
      if (siteIds.length > 1) {
        throw new BadRequestException(TDS_ERRORS.MIXED_SITE);
      }
      for (const entry of entries) {
        if (entry.tdsPaymentId) {
          throw new BadRequestException(
            TDS_ERRORS.ALREADY_IN_CHALLAN(entry.invoice?.invoiceNumber ?? entry.invoiceId),
          );
        }
      }

      const vendorIds = [...new Set(entries.map((e) => e.vendorId))];
      const netAmount = Number(entries.reduce((sum, e) => sum + Number(e.tdsAmount), 0).toFixed(2));

      const payment = await this.tdsRepository.createPayment(
        {
          siteId: siteIds[0],
          partyType: PartyType.PURCHASE,
          contractorId: null,
          vendorId: vendorIds.length === 1 ? vendorIds[0] : null,
          paymentMonth: entries[0].invoiceMonth,
          financialYear: getFinancialYear(dto.paymentDate),
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
        message: TDS_RESPONSES.CHALLAN_RECORDED,
        id: payment.id,
        netAmount,
        entriesCount: entries.length,
      };
    });
  }

  /**
   * Get TDS challans list.
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
