import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  DataSource,
  IsNull,
  ILike,
  In,
  Between,
  MoreThanOrEqual,
  LessThanOrEqual,
  Equal,
} from 'typeorm';
import { PurchaseOrderRepository } from './purchase-order.repository';
import { PurchaseOrderEntity } from './entities/purchase-order.entity';
import {
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
  GetPurchaseOrderDto,
  RejectDto,
  ApproveDto,
  UnlockRequestDto,
} from './dto';
import { PO_ERRORS, PO_RESPONSES } from './constants/purchase-order.constants';
import { checkPoHasJmcsQuery } from './queries/purchase-order.queries';
import { formatUser } from 'src/modules/common/financials/user-format.helper';
import {
  PartyType,
  FinancialApprovalStatus,
  FINANCIAL_ERRORS,
} from 'src/modules/common/financials/financial.constants';
import { ContractorEntity } from 'src/modules/contractors/entities/contractor.entity';
import { VendorEntity } from 'src/modules/vendors/entities/vendor.entity';
import { SiteContractorEntity } from 'src/modules/sites/entities/site-contractor.entity';
import { SiteVendorEntity } from 'src/modules/site-vendors/entities/site-vendor.entity';
import { SiteEntity } from 'src/modules/sites/entities/site.entity';
import { DefaultPaginationValues, SortOrder } from 'src/utils/utility/constants/utility.constants';

@Injectable()
export class PurchaseOrderService {
  constructor(
    private readonly poRepository: PurchaseOrderRepository,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreatePurchaseOrderDto, createdBy: string) {
    this.validatePartyShape(dto.partyType, dto.contractorId, dto.vendorId);
    this.validateAmounts(dto.taxableAmount, dto.gstAmount ?? 0, dto.totalAmount);

    await this.assertSiteExists(dto.siteId);
    await this.assertPartyLinkedToSite(dto);

    // Uniqueness within (siteId, partyType, poNumber) — partial on deletedAt IS NULL
    const dup = await this.poRepository.findOne({
      where: {
        siteId: dto.siteId,
        partyType: dto.partyType,
        poNumber: dto.poNumber,
        deletedAt: IsNull(),
      },
    });
    if (dup) throw new ConflictException(PO_ERRORS.PO_NUMBER_EXISTS);

    const created = await this.poRepository.create({
      siteId: dto.siteId,
      partyType: dto.partyType,
      contractorId: dto.partyType === PartyType.SALE ? dto.contractorId! : null,
      vendorId: dto.partyType === PartyType.PURCHASE ? dto.vendorId! : null,
      poNumber: dto.poNumber,
      poDate: new Date(dto.poDate),
      taxableAmount: dto.taxableAmount,
      gstAmount: dto.gstAmount ?? 0,
      gstPercentage: dto.gstPercentage ?? null,
      totalAmount: dto.totalAmount,
      fileKey: dto.fileKey,
      fileName: dto.fileName,
      remarks: dto.remarks,
      approvalStatus: FinancialApprovalStatus.PENDING,
      isLocked: false,
      createdBy,
    });

    return { message: PO_RESPONSES.CREATED, id: created.id };
  }

  async findAll(query: GetPurchaseOrderDto) {
    const {
      companyId,
      siteId,
      partyType,
      contractorId,
      vendorId,
      approvalStatus,
      isLocked,
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
    if (contractorId?.length) where.contractorId = In(contractorId);
    if (vendorId?.length) where.vendorId = In(vendorId);
    if (approvalStatus?.length) where.approvalStatus = In(approvalStatus);
    if (isLocked !== undefined) where.isLocked = Equal(isLocked === 'true');
    if (dateFrom && dateTo) where.poDate = Between(dateFrom, dateTo);
    else if (dateFrom) where.poDate = MoreThanOrEqual(dateFrom);
    else if (dateTo) where.poDate = LessThanOrEqual(dateTo);
    if (search) where.poNumber = ILike(`%${search}%`);

    const [records, totalRecords] = await Promise.all([
      this.poRepository.findAll({
        where,
        order: { [sortField]: sortOrder as SortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
        relations: [
          'contractor',
          'vendor',
          'site',
          'site.company',
          'createdByUser',
          'updatedByUser',
          'approvalByUser',
          'unlockRequestedByUser',
        ],
      }),
      this.poRepository.count({ where }),
    ]);

    return {
      records: records.map((po) => {
        const invoicedTotal = Number(po.invoicedTotal) || 0;
        const totalAmount = Number(po.totalAmount) || 0;
        const invoiceCeilingFull = invoicedTotal >= totalAmount;

        return {
          ...po,
          createdByUser: formatUser(po.createdByUser),
          updatedByUser: formatUser(po.updatedByUser),
          approvalByUser: formatUser(po.approvalByUser),
          unlockRequestedByUser: formatUser(po.unlockRequestedByUser),
          // Dropdown hint: disable POs whose invoice ceiling is fully exhausted
          isDisabled: invoiceCeilingFull,
          disabledReason: invoiceCeilingFull
            ? `Invoice ceiling fully used (₹${invoicedTotal.toLocaleString(
                'en-IN',
              )} of ₹${totalAmount.toLocaleString('en-IN')})`
            : null,
        };
      }),
      totalRecords,
    };
  }

  async findById(id: string) {
    const po = await this.poRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: [
        'contractor',
        'vendor',
        'site',
        'site.company',
        'createdByUser',
        'updatedByUser',
        'approvalByUser',
        'unlockRequestedByUser',
      ],
    });
    if (!po) throw new NotFoundException(PO_ERRORS.NOT_FOUND);
    return {
      ...po,
      createdByUser: formatUser(po.createdByUser),
      updatedByUser: formatUser(po.updatedByUser),
      approvalByUser: formatUser(po.approvalByUser),
      unlockRequestedByUser: formatUser(po.unlockRequestedByUser),
    };
  }

  async update(id: string, dto: UpdatePurchaseOrderDto, updatedBy: string) {
    const po = await this.findActiveById(id);
    this.assertEditable(po);

    if (dto.poNumber && dto.poNumber !== po.poNumber) {
      const dup = await this.poRepository.findOne({
        where: {
          siteId: po.siteId,
          partyType: po.partyType,
          poNumber: dto.poNumber,
          deletedAt: IsNull(),
        },
      });
      if (dup && dup.id !== id) throw new ConflictException(PO_ERRORS.PO_NUMBER_EXISTS);
    }

    // UpdatePurchaseOrderDto deliberately omits @Type(() => Number) so absent
    // numeric fields stay undefined (not 0) under the global ValidationPipe's
    // enableImplicitConversion. The ?? fallback below is therefore safe.
    const newTaxable = dto.taxableAmount ?? Number(po.taxableAmount);
    const newGst = dto.gstAmount ?? Number(po.gstAmount);
    const newTotal = dto.totalAmount ?? Number(po.totalAmount);
    this.validateAmounts(newTaxable, newGst, newTotal);

    await this.poRepository.update({ id }, {
      ...dto,
      poDate: dto.poDate ? new Date(dto.poDate) : undefined,
      updatedBy,
    } as Partial<PurchaseOrderEntity>);

    return { message: PO_RESPONSES.UPDATED };
  }

  async remove(id: string, deletedBy: string) {
    const po = await this.findActiveById(id);
    this.assertEditable(po); // PENDING + unlocked

    // Reject if any JMC exists on this PO
    const childCheck = await this.dataSource.query(checkPoHasJmcsQuery, [id]);
    if (childCheck.length > 0) {
      throw new BadRequestException(PO_ERRORS.CANNOT_DELETE_HAS_JMCS);
    }

    await this.poRepository.update({ id }, { deletedBy });
    await this.poRepository.softDelete({ id });

    return { message: PO_RESPONSES.DELETED };
  }

  // ── Approval workflow ──────────────────────────────────────────

  async approve(id: string, dto: ApproveDto, approvedBy: string) {
    const po = await this.findActiveById(id);
    if (po.approvalStatus === FinancialApprovalStatus.APPROVED) {
      throw new ConflictException(FINANCIAL_ERRORS.ALREADY_APPROVED);
    }

    await this.poRepository.update(
      { id },
      {
        approvalStatus: FinancialApprovalStatus.APPROVED,
        approvalBy: approvedBy,
        approvalAt: new Date(),
        approvalReason: dto.reason ?? null,
        isLocked: true,
        unlockRequestedAt: null,
        unlockRequestedBy: null,
        unlockReason: null,
        updatedBy: approvedBy,
      },
    );
    return { message: PO_RESPONSES.APPROVED };
  }

  async reject(id: string, dto: RejectDto, rejectedBy: string) {
    const po = await this.findActiveById(id);
    if (po.approvalStatus === FinancialApprovalStatus.APPROVED) {
      throw new BadRequestException(FINANCIAL_ERRORS.CANNOT_REJECT_APPROVED);
    }
    if (po.approvalStatus === FinancialApprovalStatus.REJECTED) {
      throw new ConflictException(FINANCIAL_ERRORS.ALREADY_REJECTED);
    }

    await this.poRepository.update(
      { id },
      {
        approvalStatus: FinancialApprovalStatus.REJECTED,
        approvalBy: rejectedBy,
        approvalAt: new Date(),
        approvalReason: dto.reason,
        isLocked: false,
        updatedBy: rejectedBy,
      },
    );
    return { message: PO_RESPONSES.REJECTED };
  }

  async rejectUnlock(id: string, rejectedBy: string) {
    const po = await this.findActiveById(id);
    if (!po.unlockRequestedAt) {
      throw new BadRequestException(FINANCIAL_ERRORS.UNLOCK_REJECT_NO_REQUEST);
    }
    await this.poRepository.update(
      { id },
      {
        unlockRequestedAt: null,
        unlockRequestedBy: null,
        unlockReason: null,
        updatedBy: rejectedBy,
      },
    );
    return { message: PO_RESPONSES.UNLOCK_REJECTED };
  }

  async requestUnlock(id: string, dto: UnlockRequestDto, requestedBy: string) {
    const po = await this.findActiveById(id);
    if (!po.isLocked || po.approvalStatus !== FinancialApprovalStatus.APPROVED) {
      throw new BadRequestException(PO_ERRORS.ONLY_APPROVED_LOCKED_CAN_UNLOCK);
    }
    await this.poRepository.update(
      { id },
      {
        unlockRequestedAt: new Date(),
        unlockRequestedBy: requestedBy,
        unlockReason: dto.reason,
        updatedBy: requestedBy,
      },
    );
    return { message: PO_RESPONSES.UNLOCK_REQUESTED };
  }

  async grantUnlock(id: string, grantedBy: string) {
    const po = await this.findActiveById(id);
    if (!po.unlockRequestedAt) {
      throw new BadRequestException(FINANCIAL_ERRORS.UNLOCK_NOT_REQUESTED);
    }
    await this.poRepository.update(
      { id },
      {
        approvalStatus: FinancialApprovalStatus.PENDING,
        approvalBy: null,
        approvalAt: null,
        approvalReason: null,
        isLocked: false,
        unlockRequestedAt: null,
        unlockRequestedBy: null,
        unlockReason: null,
        updatedBy: grantedBy,
      },
    );
    return { message: PO_RESPONSES.UNLOCK_GRANTED };
  }

  // ── Service methods exposed for downstream modules (proper service-to-service communication) ────────────

  /**
   * Used by Invoice approval, Book Payment insert, and Bank Transfer insert
   * to lock the PO and assert ceilings inside their transactions.
   */
  async lockAndAssertCeiling(
    poId: string,
    delta: { invoicedTotal?: number; bookedTotal?: number; paidTotal?: number },
    em: import('typeorm').EntityManager,
  ) {
    const po = await this.poRepository.findOneForUpdate(poId, em);
    if (!po) throw new NotFoundException(PO_ERRORS.NOT_FOUND);
    if (po.approvalStatus !== FinancialApprovalStatus.APPROVED) {
      throw new BadRequestException(FINANCIAL_ERRORS.PARENT_NOT_APPROVED);
    }
    if (delta.invoicedTotal !== undefined) {
      const next = Number(po.invoicedTotal) + delta.invoicedTotal;
      if (next > Number(po.totalAmount)) {
        throw new BadRequestException(FINANCIAL_ERRORS.PO_CEILING_EXCEEDED);
      }
    }
    return po;
  }

  /**
   * Atomically adjust rollup columns inside a transaction.
   * Used by downstream modules (invoices, book payments, bank transfers)
   * to maintain denormalized totals on the PO.
   */
  async adjustRollups(
    poId: string,
    delta: {
      invoicedTotal?: number;
      bookedTotal?: number;
      paidTotal?: number;
      lastInvoiceAt?: Date;
      lastPaymentAt?: Date;
    },
    em: import('typeorm').EntityManager,
  ): Promise<void> {
    await this.poRepository.adjustRollups(poId, delta, em);
  }

  /**
   * Lock a PO row inside a transaction for update.
   * Used by downstream modules that need pessimistic locking.
   */
  async findOneForUpdate(
    poId: string,
    em: import('typeorm').EntityManager,
  ): Promise<PurchaseOrderEntity | null> {
    return await this.poRepository.findOneForUpdate(poId, em);
  }

  // ── Private helpers ───────────────────────────────────────────

  private async findActiveById(id: string): Promise<PurchaseOrderEntity> {
    const po = await this.poRepository.findOne({ where: { id, deletedAt: IsNull() } });
    if (!po) throw new NotFoundException(PO_ERRORS.NOT_FOUND);
    return po;
  }

  private validatePartyShape(partyType: PartyType, contractorId?: string, vendorId?: string): void {
    if (partyType === PartyType.SALE) {
      if (!contractorId || vendorId) {
        throw new BadRequestException(FINANCIAL_ERRORS.PARTY_INVALID);
      }
    } else if (partyType === PartyType.PURCHASE) {
      if (!vendorId || contractorId) {
        throw new BadRequestException(FINANCIAL_ERRORS.PARTY_INVALID);
      }
    } else {
      throw new BadRequestException(FINANCIAL_ERRORS.PARTY_INVALID);
    }
  }

  private validateAmounts(taxable: number, gst: number, total: number): void {
    const expected = Number((Number(taxable) + Number(gst)).toFixed(2));
    const got = Number(Number(total).toFixed(2));
    if (expected !== got) {
      throw new BadRequestException(FINANCIAL_ERRORS.AMOUNT_VALIDATION_FAILED);
    }
  }

  private async assertSiteExists(siteId: string): Promise<void> {
    const site = await this.dataSource
      .getRepository(SiteEntity)
      .findOne({ where: { id: siteId, deletedAt: IsNull() } });
    if (!site) throw new NotFoundException(PO_ERRORS.SITE_NOT_FOUND);
  }

  private async assertPartyLinkedToSite(dto: CreatePurchaseOrderDto): Promise<void> {
    if (dto.partyType === PartyType.SALE) {
      const link = await this.dataSource
        .getRepository(SiteContractorEntity)
        .findOne({ where: { siteId: dto.siteId, contractorId: dto.contractorId! } });
      if (!link) {
        // also accept if contractor exists at all (legacy data); enforce link only if SiteContractor row required
        const contractor = await this.dataSource
          .getRepository(ContractorEntity)
          .findOne({ where: { id: dto.contractorId!, deletedAt: IsNull() } });
        if (!contractor) {
          throw new BadRequestException(PO_ERRORS.CONTRACTOR_NOT_FOUND_FOR_SALE);
        }
      }
    } else {
      const link = await this.dataSource
        .getRepository(SiteVendorEntity)
        .findOne({ where: { siteId: dto.siteId, vendorId: dto.vendorId! } });
      if (!link) {
        const vendor = await this.dataSource
          .getRepository(VendorEntity)
          .findOne({ where: { id: dto.vendorId!, deletedAt: IsNull() } });
        if (!vendor) {
          throw new BadRequestException(PO_ERRORS.VENDOR_NOT_FOUND_FOR_PURCHASE);
        }
      }
    }
  }

  private assertEditable(po: PurchaseOrderEntity): void {
    if (po.approvalStatus !== FinancialApprovalStatus.PENDING) {
      throw new BadRequestException(FINANCIAL_ERRORS.CANNOT_DELETE_NOT_PENDING);
    }
    if (po.isLocked) {
      throw new BadRequestException(FINANCIAL_ERRORS.CANNOT_EDIT_LOCKED);
    }
  }

  /**
   * Dropdown endpoint — returns POs for a site+partyType with eligibility
   * flags so the frontend can disable ineligible items and show a reason.
   *
   * Used when creating a JMC. A PO is eligible when it is APPROVED AND
   * its invoice ceiling is not fully exhausted (invoicedTotal < totalAmount).
   */
  async getDropdown(siteId: string, partyType: string) {
    const rows = await this.dataSource.query(
      `
      SELECT
        po.id,
        po."poNumber",
        po."partyType",
        po."totalAmount",
        po."invoicedTotal",
        po."approvalStatus",
        po."isLocked",
        COALESCE(c.name, v.name)   AS "partyName",
        COALESCE(c.id, v.id)       AS "partyId",
        -- eligibility: NOT REJECTED and invoice ceiling not fully used
        -- (PENDING POs are now allowed for JMC creation; approval chain enforced at approval time)
        CASE
          WHEN po."approvalStatus" = 'REJECTED' THEN false
          WHEN COALESCE(po."invoicedTotal", 0) >= po."totalAmount" THEN false
          ELSE true
        END AS eligible,
        CASE
          WHEN po."approvalStatus" = 'REJECTED' THEN 'PO was rejected'
          WHEN COALESCE(po."invoicedTotal", 0) >= po."totalAmount"
          THEN 'Invoice ceiling fully used for this PO'
          WHEN po."approvalStatus" = 'PENDING'
          THEN 'PO not yet approved — JMC can be created but invoice cannot be approved until PO is approved'
          ELSE NULL
        END AS reason
      FROM purchase_orders po
      LEFT JOIN contractors c ON c.id = po."contractorId" AND c."deletedAt" IS NULL
      LEFT JOIN vendors     v ON v.id = po."vendorId"     AND v."deletedAt" IS NULL
      WHERE po."siteId"    = $1
        AND po."partyType" = $2
        AND po."deletedAt" IS NULL
      ORDER BY po."createdAt" DESC
      `,
      [siteId, partyType],
    );

    return {
      records: rows.map((r: any) => {
        const totalAmount = Number(r.totalAmount);
        const invoicedTotal = Number(r.invoicedTotal) || 0;
        const remaining = totalAmount - invoicedTotal;

        return {
          id: r.id,
          label: `${r.poNumber} — ${r.partyName ?? 'Unknown'}`,
          eligible: r.eligible,
          reason: r.reason ?? null,
          meta: {
            poNumber: r.poNumber,
            partyType: r.partyType,
            partyName: r.partyName,
            totalAmount,
            invoicedTotal,
            remaining,
            approvalStatus: r.approvalStatus,
          },
        };
      }),
    };
  }
}
