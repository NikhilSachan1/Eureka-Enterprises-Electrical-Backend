import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  Between,
  DataSource,
  EntityManager,
  ILike,
  In,
  IsNull,
  LessThanOrEqual,
  MoreThanOrEqual,
} from 'typeorm';
import { AdvancePaymentRepository } from './advance-payment.repository';
import { AdvancePaymentEntity } from './entities/advance-payment.entity';
import { CreateAdvancePaymentDto, UpdateAdvancePaymentDto, GetAdvancePaymentDto } from './dto';
import {
  ADVANCE_NUMBER_CONFIG_KEY,
  ADVANCE_PAYMENT_ERRORS,
  ADVANCE_PAYMENT_RESPONSES,
} from './constants/advance-payment.constants';
import { PurchaseOrderEntity } from 'src/modules/purchase-orders/entities/purchase-order.entity';
import {
  PartyType,
  FinancialApprovalStatus,
} from 'src/modules/common/financials/financial.constants';
import { checkSiteCreateAccess } from 'src/modules/common/financials/site-access.helper';
import { formatInr } from 'src/modules/common/financials/amount-format.helper';
import { formatUser } from 'src/modules/common/financials/user-format.helper';
import { DefaultPaginationValues, SortOrder } from 'src/utils/utility/constants/utility.constants';
import { RejectDto } from 'src/modules/purchase-orders/dto/approval.dto';
import { PurchaseOrderRepository } from 'src/modules/purchase-orders/purchase-order.repository';

@Injectable()
export class AdvancePaymentService {
  private readonly logger = new Logger(AdvancePaymentService.name);

  constructor(
    private readonly advanceRepository: AdvancePaymentRepository,
    private readonly poRepository: PurchaseOrderRepository,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // ─────────────────────────── number generation ───────────────────────────

  /**
   * Next advance number, e.g. ADV-10001.
   *
   * `startFrom` acts as a floor rather than a counter: it only applies while MAX is below it.
   * Without it an empty table would restart the sequence at 1 — the exact bug the vendor-code
   * work had to go back and fix, so it is built in here from the start.
   */
  private async generateAdvanceNumber(em?: EntityManager): Promise<string> {
    const db = em ?? this.dataSource;
    const cfgRows = await db.query(
      `SELECT cs.value
         FROM config_settings cs
         JOIN configurations c ON c.id = cs."configId"
        WHERE c.key = $1 AND cs."isActive" = true AND cs."deletedAt" IS NULL
        ORDER BY cs."createdAt" DESC
        LIMIT 1`,
      [ADVANCE_NUMBER_CONFIG_KEY],
    );

    // node-pg parses jsonb already — do not JSON.parse again.
    const cfg = (cfgRows?.[0]?.value ?? {}) as {
      prefix?: string;
      padLength?: number;
      startFrom?: number;
    };
    const prefix = cfg.prefix ?? 'ADV-';
    const padLength = Number(cfg.padLength ?? 5);
    const startFrom = Number(cfg.startFrom ?? 1);

    const rows = await db.query(
      `SELECT COALESCE(MAX(CAST(substring("advanceNumber" from '(\\d+)$') AS INTEGER)), 0) AS maxseq
         FROM advance_payments
        WHERE "advanceNumber" LIKE $1`,
      [`${prefix}%`],
    );

    const next = Math.max(Number(rows?.[0]?.maxseq ?? 0), startFrom - 1) + 1;
    return `${prefix}${String(next).padStart(padLength, '0')}`;
  }

  async previewNextNumber(): Promise<{ advanceNumber: string }> {
    return { advanceNumber: await this.generateAdvanceNumber() };
  }

  // ─────────────────────────── validation helpers ───────────────────────────

  /**
   * The PO an advance may be raised against: it must exist, be PURCHASE, and be APPROVED.
   *
   * Approval matters because the headroom check below is computed from PO totals, and those are
   * not meaningful until the PO itself is approved — paying an advance against a PO that is later
   * rejected would leave money out against nothing.
   */
  private async loadEligiblePo(poId: string, em?: EntityManager): Promise<PurchaseOrderEntity> {
    const po = await (em ?? this.dataSource)
      .getRepository(PurchaseOrderEntity)
      .findOne({ where: { id: poId, deletedAt: IsNull() } });

    if (!po) throw new NotFoundException(ADVANCE_PAYMENT_ERRORS.PO_NOT_FOUND);
    if (po.partyType !== PartyType.PURCHASE) {
      throw new BadRequestException(ADVANCE_PAYMENT_ERRORS.PO_NOT_PURCHASE);
    }
    if (po.approvalStatus !== FinancialApprovalStatus.APPROVED) {
      throw new BadRequestException(
        ADVANCE_PAYMENT_ERRORS.PO_NOT_APPROVED.replace(
          '{status}',
          String(po.approvalStatus).toLowerCase(),
        ),
      );
    }
    return po;
  }

  /**
   * An advance may only draw against the part of the PO that has **not** been invoiced.
   *
   * Checking against `po.totalAmount` alone would let advances and invoices jointly exceed the PO:
   * an advance is money paid for work not yet billed, so it competes with the uninvoiced remainder,
   * not the whole PO value.
   *
   * Re-run at approval as well as create, because several advances can sit PENDING at once and
   * each would pass the create-time check in isolation.
   */
  private async assertWithinPoLimit(
    po: PurchaseOrderEntity,
    amount: number,
    em?: EntityManager,
    excludeAdvanceId?: string,
  ): Promise<void> {
    const alreadyAdvanced = await this.advanceRepository.sumApprovedByPo(
      po.id,
      em,
      excludeAdvanceId,
    );
    const poTotal = Number(po.totalAmount ?? 0);
    const invoiced = Number(po.invoicedTotal ?? 0);
    const available = poTotal - invoiced - alreadyAdvanced;

    if (amount > available) {
      throw new BadRequestException(
        ADVANCE_PAYMENT_ERRORS.EXCEEDS_PO_LIMIT.replace('{requested}', formatInr(amount))
          .replace('{poTotal}', formatInr(poTotal))
          .replace('{invoiced}', formatInr(invoiced))
          .replace('{advanced}', formatInr(alreadyAdvanced))
          .replace('{available}', formatInr(Math.max(0, available))),
      );
    }
  }

  /**
   * Creating an advance is reserved for the site's Project Manager; office roles bypass via
   * `activeRole`, exactly as PO creation and site-vendor assignment do.
   *
   * "Project Manager" is a site_allocations role, not a system role, so the permission on the route
   * is necessarily coarse — this is what narrows it to the PM of *this* site.
   */
  private async assertSiteAccess(siteId: string, userId: string, activeRole?: string) {
    const { allowed, reason } = await checkSiteCreateAccess(this.dataSource, userId, siteId, {
      requirePm: true,
      activeRole,
    });
    if (!allowed) {
      throw new ForbiddenException(reason ?? 'Not allowed to record an advance for this site');
    }
  }

  /**
   * An advance is frozen once money has moved or it has been reconciled. Both conditions are
   * checked because they are independent: a booking can exist without settlement and vice versa.
   */
  private assertMutable(advance: AdvancePaymentEntity): void {
    if (advance.hasBookPayment) {
      throw new BadRequestException(ADVANCE_PAYMENT_ERRORS.LOCKED_HAS_BOOK_PAYMENT);
    }
    if (Number(advance.settledAmount) > 0) {
      throw new BadRequestException(
        ADVANCE_PAYMENT_ERRORS.LOCKED_SETTLED.replace(
          '{settled}',
          formatInr(Number(advance.settledAmount)),
        ),
      );
    }
  }

  private async findActiveOrFail(id: string): Promise<AdvancePaymentEntity> {
    const advance = await this.advanceRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!advance) throw new NotFoundException(ADVANCE_PAYMENT_ERRORS.NOT_FOUND);
    return advance;
  }

  // ─────────────────────────────── commands ───────────────────────────────

  async create(dto: CreateAdvancePaymentDto, createdBy: string, activeRole?: string) {
    return await this.dataSource.transaction(async (em) => {
      const po = await this.loadEligiblePo(dto.poId, em);
      await this.assertSiteAccess(po.siteId, createdBy, activeRole);
      await this.assertWithinPoLimit(po, Number(dto.amount), em);

      const advanceNumber = await this.generateAdvanceNumber(em);

      const created = await this.advanceRepository.create(
        {
          advanceNumber,
          vendorAdvanceNumber: dto.vendorAdvanceNumber?.trim() || null,
          poId: po.id,
          siteId: po.siteId,
          vendorId: po.vendorId,
          advanceDate: new Date(dto.advanceDate),
          amount: Number(dto.amount),
          settledAmount: 0,
          fileKey: dto.fileKey ?? null,
          fileName: dto.fileName ?? null,
          remarks: dto.remarks ?? null,
          approvalStatus: FinancialApprovalStatus.PENDING,
          hasBookPayment: false,
          createdBy,
        },
        em,
      );

      return {
        message: ADVANCE_PAYMENT_RESPONSES.CREATED,
        id: created.id,
        advanceNumber: created.advanceNumber,
      };
    });
  }

  async update(id: string, dto: UpdateAdvancePaymentDto, updatedBy: string) {
    return await this.dataSource.transaction(async (em) => {
      const advance = await this.advanceRepository.findOneForUpdate(id, em);
      if (!advance) throw new NotFoundException(ADVANCE_PAYMENT_ERRORS.NOT_FOUND);
      this.assertMutable(advance);

      // A raised amount has to re-clear the PO headroom, excluding this advance's own contribution
      // so it is not counted against itself.
      if (dto.amount !== undefined && Number(dto.amount) !== Number(advance.amount)) {
        const po = await this.loadEligiblePo(advance.poId, em);
        await this.assertWithinPoLimit(po, Number(dto.amount), em, advance.id);
      }

      // An approved advance is already counted in the PO's advancePaidTotal, so a changed amount
      // has to move the rollup by the difference. A pending one contributes nothing yet.
      if (
        dto.amount !== undefined &&
        Number(dto.amount) !== Number(advance.amount) &&
        advance.approvalStatus === FinancialApprovalStatus.APPROVED
      ) {
        await this.poRepository.adjustRollups(
          advance.poId,
          { advancePaidTotal: Number(dto.amount) - Number(advance.amount) },
          em,
        );
      }

      await this.advanceRepository.update(
        { id },
        {
          ...(dto.advanceDate !== undefined ? { advanceDate: new Date(dto.advanceDate) } : {}),
          ...(dto.amount !== undefined ? { amount: Number(dto.amount) } : {}),
          ...(dto.vendorAdvanceNumber !== undefined
            ? { vendorAdvanceNumber: dto.vendorAdvanceNumber?.trim() || null }
            : {}),
          ...(dto.fileKey !== undefined ? { fileKey: dto.fileKey } : {}),
          ...(dto.fileName !== undefined ? { fileName: dto.fileName } : {}),
          ...(dto.remarks !== undefined ? { remarks: dto.remarks } : {}),
          updatedBy,
        },
        em,
      );

      return { message: ADVANCE_PAYMENT_RESPONSES.UPDATED };
    });
  }

  async remove(id: string, deletedBy: string) {
    return await this.dataSource.transaction(async (em) => {
      const advance = await this.advanceRepository.findOneForUpdate(id, em);
      if (!advance) throw new NotFoundException(ADVANCE_PAYMENT_ERRORS.NOT_FOUND);
      this.assertMutable(advance);

      // Deleting an approved advance takes its money back out of the PO rollup; a pending one was
      // never in it.
      if (advance.approvalStatus === FinancialApprovalStatus.APPROVED) {
        await this.poRepository.adjustRollups(
          advance.poId,
          { advancePaidTotal: -Number(advance.amount) },
          em,
        );
      }

      await this.advanceRepository.update({ id }, { deletedBy }, em);
      await this.advanceRepository.softDelete({ id }, em);

      return { message: ADVANCE_PAYMENT_RESPONSES.DELETED };
    });
  }

  async approve(id: string, approvedBy: string) {
    return await this.dataSource.transaction(async (em) => {
      const advance = await this.advanceRepository.findOneForUpdate(id, em);
      if (!advance) throw new NotFoundException(ADVANCE_PAYMENT_ERRORS.NOT_FOUND);

      if (advance.approvalStatus === FinancialApprovalStatus.APPROVED) {
        throw new BadRequestException(ADVANCE_PAYMENT_ERRORS.ALREADY_APPROVED);
      }

      // Re-check the ceiling here, not just at create: other advances on this PO may have been
      // approved in between, and each would have passed its own create-time check in isolation.
      const po = await this.loadEligiblePo(advance.poId, em);
      await this.assertWithinPoLimit(po, Number(advance.amount), em, advance.id);

      await this.advanceRepository.update(
        { id },
        {
          approvalStatus: FinancialApprovalStatus.APPROVED,
          approvalBy: approvedBy,
          approvalAt: new Date(),
          rejectionReason: null,
          updatedBy: approvedBy,
        },
        em,
      );

      // Approval is the point the money becomes committed against the PO — the headroom check
      // counts APPROVED advances only, so the rollup follows the same rule.
      await this.poRepository.adjustRollups(
        advance.poId,
        { advancePaidTotal: Number(advance.amount) },
        em,
      );

      this.logger.log(`Advance ${advance.advanceNumber} approved by ${approvedBy}`);
      return { message: ADVANCE_PAYMENT_RESPONSES.APPROVED };
    });
  }

  async reject(id: string, dto: RejectDto, rejectedBy: string) {
    // Transactional because rejecting an already-approved advance also has to take its money back
    // out of the PO rollup, and the two must not be able to diverge.
    return await this.dataSource.transaction(async (em) => {
      const advance = await this.advanceRepository.findOneForUpdate(id, em);
      if (!advance) throw new NotFoundException(ADVANCE_PAYMENT_ERRORS.NOT_FOUND);

      if (advance.approvalStatus === FinancialApprovalStatus.REJECTED) {
        throw new BadRequestException(ADVANCE_PAYMENT_ERRORS.ALREADY_REJECTED);
      }
      // Rejecting after money has moved would strand a booked payment against a dead document.
      this.assertMutable(advance);

      if (!dto?.reason?.trim()) {
        throw new BadRequestException(ADVANCE_PAYMENT_ERRORS.REJECT_REASON_REQUIRED);
      }

      if (advance.approvalStatus === FinancialApprovalStatus.APPROVED) {
        await this.poRepository.adjustRollups(
          advance.poId,
          { advancePaidTotal: -Number(advance.amount) },
          em,
        );
      }

      await this.advanceRepository.update(
        { id },
        {
          approvalStatus: FinancialApprovalStatus.REJECTED,
          approvalBy: rejectedBy,
          approvalAt: new Date(),
          rejectionReason: dto.reason.trim(),
          updatedBy: rejectedBy,
        },
        em,
      );

      return { message: ADVANCE_PAYMENT_RESPONSES.REJECTED };
    });
  }

  // ──────────────────────────────── queries ────────────────────────────────

  async findAll(query: GetAdvancePaymentDto) {
    const {
      siteId,
      vendorId,
      poId,
      approvalStatus,
      dateFrom,
      dateTo,
      search,
      unsettledOnly,
      sortField = DefaultPaginationValues.SORT_FIELD,
      sortOrder = DefaultPaginationValues.SORT_ORDER,
      page = DefaultPaginationValues.PAGE,
      pageSize = DefaultPaginationValues.PAGE_SIZE,
    } = query;

    const where: Record<string, unknown> = { deletedAt: IsNull() };
    if (siteId?.length) where.siteId = In(siteId);
    if (vendorId?.length) where.vendorId = In(vendorId);
    if (poId) where.poId = poId;
    if (approvalStatus?.length) where.approvalStatus = In(approvalStatus);
    if (dateFrom && dateTo) where.advanceDate = Between(dateFrom, dateTo);
    else if (dateFrom) where.advanceDate = MoreThanOrEqual(dateFrom);
    else if (dateTo) where.advanceDate = LessThanOrEqual(dateTo);

    // `search` spans two number columns, so it needs an OR — expressed as two where-objects,
    // which TypeORM treats as a union.
    const baseWheres = search
      ? [
          { ...where, advanceNumber: ILike(`%${search}%`) },
          { ...where, vendorAdvanceNumber: ILike(`%${search}%`) },
          { ...where, remarks: ILike(`%${search}%`) },
        ]
      : [where];

    const [records, totalRecords] = await Promise.all([
      this.advanceRepository.findAll({
        where: baseWheres as never,
        order: { [sortField]: sortOrder as SortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
        relations: ['po', 'site', 'vendor', 'createdByUser', 'approvalByUser'],
      }),
      this.advanceRepository.count({ where: baseWheres as never }),
    ]);

    const shaped = records.map((r) => this.shape(r));
    // Applied after the query rather than in SQL: `unsettledOnly` is a derived comparison between
    // two columns, and expressing it in the where-object union above would double the clauses.
    const filtered = unsettledOnly === 'true' ? shaped.filter((r) => r.balanceAmount > 0) : shaped;

    return { records: filtered, totalRecords };
  }

  async findOne(id: string) {
    const advance = await this.advanceRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ['po', 'site', 'vendor', 'createdByUser', 'approvalByUser'],
    });
    if (!advance) throw new NotFoundException(ADVANCE_PAYMENT_ERRORS.NOT_FOUND);
    return this.shape(advance);
  }

  /** Adds the derived balance so callers never have to recompute amount − settled themselves. */
  private shape(a: AdvancePaymentEntity) {
    const amount = Number(a.amount);
    const settled = Number(a.settledAmount);
    return {
      id: a.id,
      advanceNumber: a.advanceNumber,
      vendorAdvanceNumber: a.vendorAdvanceNumber,
      poId: a.poId,
      poNumber: a.po?.poNumber ?? null,
      siteId: a.siteId,
      siteName: a.site?.name ?? null,
      vendorId: a.vendorId,
      vendorName: a.vendor?.name ?? null,
      advanceDate: a.advanceDate,
      amount,
      settledAmount: settled,
      balanceAmount: amount - settled,
      isFullySettled: settled >= amount,
      fileKey: a.fileKey,
      fileName: a.fileName,
      remarks: a.remarks,
      approvalStatus: a.approvalStatus,
      approvalAt: a.approvalAt,
      rejectionReason: a.rejectionReason,
      hasBookPayment: a.hasBookPayment,
      createdAt: a.createdAt,
      createdByUser: formatUser(a.createdByUser),
      approvalByUser: formatUser(a.approvalByUser),
    };
  }
}
