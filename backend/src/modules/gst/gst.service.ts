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
import { PartyType, getFinancialYear } from 'src/modules/common/financials/financial.constants';
import { DefaultPaginationValues, SortOrder } from 'src/utils/utility/constants/utility.constants';
import { BookPaymentService } from 'src/modules/book-payments/book-payment.service';
import { BankTransferService } from 'src/modules/bank-transfers/bank-transfer.service';

/** Relations that show how an entry's held GST was settled. */
const GST_SETTLEMENT_RELATIONS = [
  'gstPayment', // legacy direct record
  'gstBookPayment',
  'gstBankTransfer',
  'gstBankTransfer.paymentAdvice',
];

/**
 * GST register — how GST actually moves:
 *
 *  Verification (both sides, every entry): the invoice is matched on the GST portal.
 *    PURCHASE → the vendor's invoice appears in our GSTR-2B (so we can take ITC).
 *    SALE     → our GSTR-1 reflects the invoice (so the client can take ITC).
 *
 *  Settlement (held entries only), through the normal payment chain:
 *    PURCHASE → we withheld the vendor's GST. Once verified in GSTR-2B, "release" books a GST
 *               book payment (release in process); its bank transfer — from the payment sheet or
 *               directly — marks the GST released.
 *    SALE     → the client withheld our GST. "Mark received" records a GST bank transfer.
 *  GST that was not held moved with the invoice payment itself — there is nothing to settle.
 *  Entries settled before this flow carry a legacy gstPaymentId and are left as they are.
 */
@Injectable()
export class GstService {
  constructor(
    private readonly gstRepository: GstRepository,
    private readonly bookPaymentService: BookPaymentService,
    private readonly bankTransferService: BankTransferService,
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
        relations: [
          'invoice',
          'invoice.jmc',
          'invoice.jmc.po',
          'site',
          'site.company',
          'contractor',
          'vendor',
          ...GST_SETTLEMENT_RELATIONS,
        ],
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
        'invoice.jmc',
        'invoice.jmc.po',
        'site',
        'site.company',
        'contractor',
        'vendor',
        'verifiedByUser',
        ...GST_SETTLEMENT_RELATIONS,
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
   * Mark an entry as matched on the GST portal (both sides, held or not).
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

    return { message: GST_RESPONSES.ENTRY_VERIFIED };
  }

  /**
   * Revert portal verification (blocked once the held GST is settled).
   */
  async revertEntry(id: string, revertedBy: string, reason: string) {
    const entry = await this.gstRepository.findOneRegisterEntry({
      where: { id, deletedAt: IsNull() },
    });
    if (!entry) throw new NotFoundException(GST_ERRORS.ENTRY_NOT_FOUND);

    if (!entry.isVerified) {
      throw new BadRequestException(GST_ERRORS.NOT_VERIFIED);
    }
    if (entry.gstPaymentId || entry.gstBankTransferId) {
      throw new BadRequestException(GST_ERRORS.CANNOT_REVERT_SETTLED);
    }
    if (entry.gstBookPaymentId) {
      throw new BadRequestException(GST_ERRORS.CANNOT_REVERT_BOOKED);
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
   * Settle HELD GST — entry-wise bulk selection, all-or-nothing.
   *   PURCHASE → release to the vendor (entries must be verified in GSTR-2B).
   *   SALE     → record receipt from the client.
   */
  async releasePayment(dto: CreateGstPaymentDto, releasedBy: string) {
    return await this.dataSource.transaction(async (em) => {
      const entries = await this.gstRepository.getEntriesByIds(dto.entryIds, em);

      if (entries.length === 0) {
        throw new BadRequestException(GST_ERRORS.NO_ENTRIES);
      }
      if (entries.length !== dto.entryIds.length) {
        throw new BadRequestException(GST_ERRORS.ENTRIES_NOT_FOUND);
      }

      const siteIds = [...new Set(entries.map((e) => e.siteId))];
      const partyTypes = [...new Set(entries.map((e) => e.partyType))];
      if (siteIds.length > 1 || partyTypes.length > 1) {
        throw new BadRequestException(GST_ERRORS.MIXED_SITE_OR_SIDE);
      }
      const siteId = siteIds[0];
      const partyType = partyTypes[0] as PartyType;
      const isPurchase = partyType === PartyType.PURCHASE;

      if (isPurchase && new Set(entries.map((e) => e.vendorId)).size > 1) {
        throw new BadRequestException(GST_ERRORS.MIXED_VENDOR);
      }
      if (!isPurchase && new Set(entries.map((e) => e.contractorId)).size > 1) {
        throw new BadRequestException(GST_ERRORS.MIXED_CONTRACTOR);
      }

      for (const entry of entries) {
        const invoiceNumber = entry.invoice?.invoiceNumber ?? entry.invoiceId;
        if (!entry.isGstHold) {
          throw new BadRequestException(GST_ERRORS.NOT_HELD(invoiceNumber));
        }
        if (entry.gstPaymentId || entry.gstBankTransferId) {
          throw new BadRequestException(GST_ERRORS.ALREADY_SETTLED(invoiceNumber));
        }
        if (entry.gstBookPaymentId) {
          throw new BadRequestException(GST_ERRORS.RELEASE_IN_PROCESS(invoiceNumber));
        }
        if (isPurchase && !entry.isVerified) {
          throw new BadRequestException(GST_ERRORS.PURCHASE_NOT_VERIFIED(invoiceNumber));
        }
      }
      if (!isPurchase && !dto.utrNumber?.trim()) {
        throw new BadRequestException(GST_ERRORS.UTR_REQUIRED_FOR_RECEIPT);
      }

      const netAmount = Number(entries.reduce((sum, e) => sum + Number(e.gstAmount), 0).toFixed(2));
      const ids: string[] = [];

      for (const entry of entries) {
        if (isPurchase) {
          // Release to vendor → GST book payment; paid later via payment sheet / bank transfer.
          const booking = await this.bookPaymentService.bookGstReleaseWithin(em, {
            invoiceId: entry.invoiceId,
            gstAmount: Number(entry.gstAmount),
            bookingDate: new Date(dto.paymentDate),
            remarks: dto.remarks ?? null,
            createdBy: releasedBy,
          });
          await this.gstRepository.updateRegisterEntry(
            { id: entry.id, financialYear: entry.financialYear },
            { gstBookPaymentId: booking.id, updatedBy: releasedBy },
            em,
          );
          ids.push(booking.id);
        } else {
          // Receipt from client → GST bank transfer straight away.
          const transfer = await this.bankTransferService.recordGstReceiptWithin(em, {
            invoiceId: entry.invoiceId,
            gstAmount: Number(entry.gstAmount),
            utrNumber: dto.utrNumber.trim(),
            transferDate: dto.paymentDate,
            proofFileKey: dto.fileKey ?? null,
            proofFileName: dto.fileName ?? null,
            remarks: dto.remarks ?? null,
            createdBy: releasedBy,
          });
          await this.gstRepository.updateRegisterEntry(
            { id: entry.id, financialYear: entry.financialYear },
            { gstBankTransferId: transfer.id, updatedBy: releasedBy },
            em,
          );
          ids.push(transfer.id);
        }
      }

      return {
        message: isPurchase ? GST_RESPONSES.RELEASED_TO_VENDOR : GST_RESPONSES.RECEIVED_FROM_CLIENT,
        siteId,
        ...(isPurchase ? { bookPaymentIds: ids } : { bankTransferIds: ids }),
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
   * Get GST settlements list.
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
