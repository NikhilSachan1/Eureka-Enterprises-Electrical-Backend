import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  DataSource,
  EntityManager,
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
import { PoItemEntity } from './entities/po-item.entity';
import { PoDefaultItemEntity } from './entities/po-default-item.entity';
import { PoPdfService } from './po-pdf.service';
import {
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
  GetPurchaseOrderDto,
  RejectDto,
  ApproveDto,
  UnlockRequestDto,
  PoItemDto,
  PoItemSuggestionDto,
} from './dto';
import { PO_ERRORS, PO_RESPONSES, PO_UNITS_CONFIG_KEY } from './constants/purchase-order.constants';
import { checkPoHasJmcsQuery } from './queries/purchase-order.queries';
import { formatUser } from 'src/modules/common/financials/user-format.helper';
import {
  checkSiteCreateAccess,
  getReadableSiteIds,
} from 'src/modules/common/financials/site-access.helper';
import {
  PartyType,
  FinancialApprovalStatus,
  FINANCIAL_ERRORS,
  getFinancialYear,
} from 'src/modules/common/financials/financial.constants';
import { ContractorEntity } from 'src/modules/contractors/entities/contractor.entity';
import { VendorEntity } from 'src/modules/vendors/entities/vendor.entity';
import { SiteContractorEntity } from 'src/modules/sites/entities/site-contractor.entity';
import { SiteVendorEntity } from 'src/modules/site-vendors/entities/site-vendor.entity';
import { SiteEntity } from 'src/modules/sites/entities/site.entity';
import { DefaultPaginationValues, SortOrder } from 'src/utils/utility/constants/utility.constants';

@Injectable()
export class PurchaseOrderService {
  private readonly logger = new Logger(PurchaseOrderService.name);

  constructor(
    private readonly poRepository: PurchaseOrderRepository,
    private readonly dataSource: DataSource,
    private readonly poPdfService: PoPdfService,
  ) {}

  async create(dto: CreatePurchaseOrderDto, createdBy: string, activeRole?: string) {
    this.validatePartyShape(dto.partyType, dto.contractorId, dto.vendorId);
    await this.assertSiteExists(dto.siteId);
    await this.assertPartyLinkedToSite(dto);

    const items = dto.items ?? [];

    // ── System-generated flow (line items present) ──
    if (items.length) {
      if (dto.partyType !== PartyType.PURCHASE) {
        throw new BadRequestException(PO_ERRORS.ITEMS_ONLY_FOR_PURCHASE);
      }
      // Site's PM (Civil) / any allocated user (Electrical) / office roles.
      await this.assertCanCreatePo(createdBy, dto.siteId, activeRole);
      await this.assertValidUnits(items);

      return await this.dataSource.transaction(async (em) => {
        const poNumber = dto.poNumber?.trim() || (await this.generatePoNumber(em));
        await this.assertUniquePoNumber(em, dto.siteId, dto.partyType, poNumber);

        // Amounts computed server-side from line items (+ GST %).
        const taxableAmount = this.round2(items.reduce((s, it) => s + Number(it.amount), 0));
        const gstAmount = dto.gstPercentage
          ? this.round2((taxableAmount * dto.gstPercentage) / 100)
          : this.round2(dto.gstAmount ?? 0);
        const totalAmount = this.round2(taxableAmount + gstAmount);

        const created = await this.poRepository.create(
          {
            siteId: dto.siteId,
            partyType: PartyType.PURCHASE,
            contractorId: null,
            vendorId: dto.vendorId!,
            poNumber,
            poDate: new Date(dto.poDate),
            taxableAmount,
            gstAmount,
            gstPercentage: dto.gstPercentage ?? null,
            gstType: dto.gstType ?? 'CGST_SGST',
            totalAmount,
            termsAndConditions: dto.termsAndConditions ?? null,
            fileKey: null,
            fileName: null,
            isSystemGenerated: true,
            remarks: dto.remarks,
            approvalStatus: FinancialApprovalStatus.PENDING,
            isLocked: false,
            createdBy,
          },
          em,
        );

        await this.saveItems(em, created.id, items, createdBy);
        await this.upsertItemMasters(em, items, createdBy);
        return { message: PO_RESPONSES.CREATED, id: created.id, poNumber };
      });
    }

    // ── Legacy upload flow (no items) — poNumber + amounts + file required ──
    if (
      !dto.poNumber ||
      dto.taxableAmount == null ||
      dto.totalAmount == null ||
      !dto.fileKey ||
      !dto.fileName
    ) {
      throw new BadRequestException(PO_ERRORS.UPLOAD_FLOW_FIELDS_REQUIRED);
    }
    this.validateAmounts(dto.taxableAmount, dto.gstAmount ?? 0, dto.totalAmount);

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

  async findAll(query: GetPurchaseOrderDto, userId: string, activeRole?: string) {
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

    // Read-scope: employees see only their allocated sites; office roles see all.
    const readableSiteIds = await getReadableSiteIds(this.dataSource, userId, activeRole);
    if (readableSiteIds !== null) {
      const effective = siteId?.length
        ? siteId.filter((s) => readableSiteIds.includes(s))
        : readableSiteIds;
      if (effective.length === 0) return { records: [], totalRecords: 0 };
      where.siteId = In(effective);
    } else if (siteId?.length) {
      where.siteId = In(siteId);
    }

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
          'items',
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
          items: (po.items ?? []).slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
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
        'items',
        'createdByUser',
        'updatedByUser',
        'approvalByUser',
        'unlockRequestedByUser',
      ],
    });
    if (!po) throw new NotFoundException(PO_ERRORS.NOT_FOUND);
    const items = (po.items ?? []).slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    return {
      ...po,
      items,
      createdByUser: formatUser(po.createdByUser),
      updatedByUser: formatUser(po.updatedByUser),
      approvalByUser: formatUser(po.approvalByUser),
      unlockRequestedByUser: formatUser(po.unlockRequestedByUser),
    };
  }

  // ── System-generated PO: PDF, suggestions, defaults, site-scoped auth ──

  /** Generate (always fresh) the system-generated PO PDF; return a download URL. */
  async generatePdf(id: string) {
    const po = await this.poRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ['vendor', 'site', 'items'],
    });
    if (!po) throw new NotFoundException(PO_ERRORS.NOT_FOUND);
    if (!po.isSystemGenerated) {
      throw new BadRequestException(PO_ERRORS.PDF_ONLY_SYSTEM_GENERATED);
    }
    const key = await this.poPdfService.generate(
      po as PurchaseOrderEntity & { items: PoItemEntity[] },
    );
    return await this.poPdfService.getDownloadUrl(key);
  }

  /** Global PO item-name typeahead. */
  async getItemSuggestions(query: PoItemSuggestionDto) {
    const limit = query.limit ?? 20;
    const params: any[] = [];
    let where = `"deletedAt" IS NULL`;
    if (query.search) {
      params.push(`%${query.search}%`);
      where += ` AND name ILIKE $${params.length}`;
    }
    params.push(limit);
    const rows = await this.dataSource.query(
      `SELECT name, unit FROM po_item_masters WHERE ${where} ORDER BY name ASC LIMIT $${params.length}`,
      params,
    );
    // `records` used to be a plain string[]; it is now [{ name, unit }] so the typeahead can
    // pre-fill the unit last used for that item. Breaking change for FE — see the spec.
    return { records: rows.map((r: any) => ({ name: r.name, unit: r.unit ?? null })) };
  }

  /**
   * Read the latest active config_settings value for a config key. node-pg already parses jsonb
   * to a JS value (string/array/object), so return it as-is — do NOT JSON.parse again.
   */
  private async readConfigValue(key: string): Promise<any> {
    const rows = await this.dataSource.query(
      `SELECT cs.value FROM config_settings cs
       JOIN configurations c ON c.id = cs."configId"
       WHERE c.key = $1 AND cs."deletedAt" IS NULL AND cs."isActive" = true
       ORDER BY cs."createdAt" DESC LIMIT 1`,
      [key],
    );
    return rows?.[0]?.value;
  }

  /** Default line items to pre-fill a new PO (FE). Managed via the `po_default_items` table. */
  async getDefaultItems() {
    const rows = await this.dataSource.getRepository(PoDefaultItemEntity).find({
      where: { isActive: true, deletedAt: IsNull() },
      order: { sortOrder: 'ASC' },
    });
    return {
      records: rows.map((r) => ({
        itemName: r.itemName,
        hsnCode: r.hsnCode ?? null,
        make: r.make ?? null,
        unit: r.unit ?? null,
      })),
    };
  }

  /** Default Terms & Conditions template to pre-fill a new PO (FE). Config `po_default_terms`. */
  async getDefaultTerms() {
    const value = await this.readConfigValue('po_default_terms');
    return { content: typeof value === 'string' ? value : '' };
  }

  /**
   * Can this user create a PO for this site? Civil site → only the site Project Manager;
   * Electrical-only site → any currently allocated user. Office roles bypass allocation.
   */
  async canCreatePo(
    userId: string,
    siteId: string,
    activeRole?: string,
  ): Promise<{ allowed: boolean; reason: string | null }> {
    return await checkSiteCreateAccess(this.dataSource, userId, siteId, {
      requirePmForCivil: true,
      activeRole,
    });
  }

  private async assertCanCreatePo(
    userId: string,
    siteId: string,
    activeRole?: string,
  ): Promise<void> {
    const { allowed, reason } = await this.canCreatePo(userId, siteId, activeRole);
    if (!allowed)
      throw new ForbiddenException(reason ?? 'Not allowed to create a PO for this site');
  }

  private round2(n: number): number {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  }

  private async generatePoNumber(em: EntityManager): Promise<string> {
    const fy = getFinancialYear(new Date());
    const prefix = `PO/${fy}/`;
    const rows = await em.query(
      `SELECT COALESCE(MAX(CAST(substring("poNumber" from '(\\d+)$') AS INTEGER)), 0) AS maxseq
       FROM purchase_orders WHERE "poNumber" LIKE $1`,
      [`${prefix}%`],
    );
    const seq = String(Number(rows?.[0]?.maxseq ?? 0) + 1).padStart(4, '0');
    return `${prefix}${seq}`;
  }

  private async assertUniquePoNumber(
    em: EntityManager,
    siteId: string,
    partyType: string,
    poNumber: string,
  ): Promise<void> {
    const dup = await this.poRepository.findOne(
      { where: { siteId, partyType, poNumber, deletedAt: IsNull() } },
      em,
    );
    if (dup) throw new ConflictException(PO_ERRORS.PO_NUMBER_EXISTS);
  }

  private async saveItems(
    em: EntityManager,
    poId: string,
    items: PoItemDto[],
    userId: string,
  ): Promise<void> {
    const repo = em.getRepository(PoItemEntity);
    const rows = items.map((it, idx) =>
      repo.create({
        poId,
        itemName: it.itemName.trim(),
        description: it.description?.trim() || null,
        hsnCode: it.hsnCode?.trim() || null,
        make: it.make?.trim() || null,
        quantity: it.quantity,
        unit: it.unit?.trim() || null,
        rate: it.rate,
        amount: it.amount,
        sortOrder: idx,
        createdBy: userId,
      }),
    );
    await repo.save(rows);
  }

  /**
   * Rejects any line-item unit that is not in the `po_units` config.
   *
   * Deliberately fails **open** when the config row is missing or malformed: a deleted config
   * would otherwise block every PO creation, which is far worse than accepting an unvalidated
   * unit. The miss is logged so it surfaces rather than passing silently.
   */
  private async assertValidUnits(items: PoItemDto[]): Promise<void> {
    const used = [...new Set(items.map((i) => i.unit?.trim()).filter((u): u is string => !!u))];
    if (used.length === 0) {
      return;
    }

    const configured = await this.readConfigValue(PO_UNITS_CONFIG_KEY);
    if (!Array.isArray(configured) || configured.length === 0) {
      this.logger.warn(
        `Config "${PO_UNITS_CONFIG_KEY}" is missing or empty — skipping PO unit validation`,
      );
      return;
    }

    const allowed = new Set(
      configured
        .map((entry: unknown) =>
          typeof entry === 'string' ? entry : (entry as { value?: string })?.value,
        )
        .filter((v): v is string => !!v),
    );

    const offender = used.find((u) => !allowed.has(u));
    if (offender) {
      throw new BadRequestException(
        PO_ERRORS.INVALID_UNIT.replace('{unit}', offender).replace(
          '{allowed}',
          [...allowed].join(', '),
        ),
      );
    }
  }

  private async upsertItemMasters(
    em: EntityManager,
    items: PoItemDto[],
    userId: string,
  ): Promise<void> {
    // Last non-empty unit wins per name, so re-saving a PO refreshes the remembered unit.
    const byName = new Map<string, string | null>();
    for (const item of items) {
      const name = item.itemName.trim();
      if (!name) continue;
      const unit = item.unit?.trim() || null;
      byName.set(name, unit ?? byName.get(name) ?? null);
    }

    for (const [name, unit] of byName) {
      // COALESCE on update so a line saved without a unit does not wipe the remembered one.
      await em.query(
        `INSERT INTO po_item_masters (name, unit, "createdBy") VALUES ($1, $2, $3)
         ON CONFLICT (LOWER(name)) DO UPDATE
           SET unit = COALESCE(EXCLUDED.unit, po_item_masters.unit),
               "updatedAt" = NOW()`,
        [name, unit, userId ?? null],
      );
    }
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

    const { items, ...rest } = dto;

    // ── System-generated PO: items replace + recompute amounts (in a transaction) ──
    if (items !== undefined) {
      if (po.partyType !== PartyType.PURCHASE) {
        throw new BadRequestException(PO_ERRORS.ITEMS_ONLY_FOR_PURCHASE);
      }
      await this.assertValidUnits(items);
      return await this.dataSource.transaction(async (em) => {
        await em.getRepository(PoItemEntity).delete({ poId: id });
        if (items.length) {
          await this.saveItems(em, id, items, updatedBy);
          await this.upsertItemMasters(em, items, updatedBy);
        }
        const taxableAmount = this.round2(items.reduce((s, it) => s + Number(it.amount), 0));
        const gstPct = rest.gstPercentage ?? Number(po.gstPercentage ?? 0);
        const gstAmount = gstPct
          ? this.round2((taxableAmount * gstPct) / 100)
          : this.round2(rest.gstAmount ?? Number(po.gstAmount));
        const totalAmount = this.round2(taxableAmount + gstAmount);

        await this.poRepository.update(
          { id },
          {
            ...rest,
            poDate: rest.poDate ? new Date(rest.poDate) : undefined,
            taxableAmount,
            gstAmount,
            gstPercentage: gstPct || null,
            totalAmount,
            isSystemGenerated: items.length > 0 ? true : po.isSystemGenerated,
            updatedBy,
          } as Partial<PurchaseOrderEntity>,
          em,
        );
        return { message: PO_RESPONSES.UPDATED };
      });
    }

    // ── Scalar update (upload/legacy) ──
    // UpdatePurchaseOrderDto deliberately omits @Type(() => Number) so absent
    // numeric fields stay undefined (not 0) under the global ValidationPipe's
    // enableImplicitConversion. The ?? fallback below is therefore safe.
    const newTaxable = rest.taxableAmount ?? Number(po.taxableAmount);
    const newGst = rest.gstAmount ?? Number(po.gstAmount);
    const newTotal = rest.totalAmount ?? Number(po.totalAmount);
    this.validateAmounts(newTaxable, newGst, newTotal);

    await this.poRepository.update({ id }, {
      ...rest,
      poDate: rest.poDate ? new Date(rest.poDate) : undefined,
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
    // Rejection is terminal — a rejected doc is locked and cannot be resurrected.
    if (po.approvalStatus === FinancialApprovalStatus.REJECTED) {
      throw new BadRequestException(FINANCIAL_ERRORS.CANNOT_APPROVE_REJECTED);
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
        isLocked: true, // terminal — rejected docs stay locked
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
