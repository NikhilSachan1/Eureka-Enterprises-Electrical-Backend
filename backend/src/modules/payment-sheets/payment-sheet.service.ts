import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource, EntityManager, In, IsNull } from 'typeorm';
import { PaymentSheetRepository } from './payment-sheet.repository';
import { PaymentSheetEntity } from './entities/payment-sheet.entity';
import { PaymentSheetItemEntity } from './entities/payment-sheet-item.entity';
import {
  CreatePaymentSheetDto,
  AddPaymentSheetItemsDto,
  UpdatePaymentSheetDto,
  PaymentSheetItemInputDto,
  EditItemAmountDto,
  StageActionDto,
  PayItemDto,
  QueryPaymentSheetDto,
  VerifyItemsDto,
  UnverifyItemsDto,
} from './dto';
import {
  PaymentSheetStatus,
  PaymentSheetItemStatus,
  BeneficiaryType,
  PaymentSourceType,
  PaymentSheetStage,
  StageAction,
  ItemHistoryAction,
  ApprovalStageConfig,
  DEFAULT_APPROVAL_FLOW,
  PAYMENT_SHEET_CONFIG,
  PAYMENT_SHEET_DEFAULTS,
  PAYMENT_SHEET_ERRORS,
  PAYMENT_SHEET_RESPONSES,
} from './constants/payment-sheet.constants';
import {
  userExpensePendingQuery,
  userFuelPendingQuery,
  bookPaymentsTransferableQuery,
  usersExpensePendingQuery,
  usersFuelPendingQuery,
  bookPaymentInvoiceDetailQuery,
} from './queries/payment-sheet.queries';
import { ExpenseTrackerService } from 'src/modules/expense-tracker/expense-tracker.service';
import { FuelExpenseService } from 'src/modules/fuel-expense/fuel-expense.service';
import { BankTransferService } from 'src/modules/bank-transfers/bank-transfer.service';
import { EmailService } from 'src/modules/common/email/email.service';
import { PaymentSheetPdfService } from './payment-sheet-pdf.service';
import { PartyType, getFinancialYear } from 'src/modules/common/financials/financial.constants';
import { EntrySourceType } from 'src/utils/master-constants/master-constants';
import { SortOrder } from 'src/utils/utility/constants/utility.constants';

export interface ActingUser {
  id: string;
  activeRole: string;
}

const SUPER_ADMIN = 'SUPER_ADMIN';

@Injectable()
export class PaymentSheetService {
  private readonly logger = new Logger(PaymentSheetService.name);

  constructor(
    private readonly repo: PaymentSheetRepository,
    private readonly dataSource: DataSource,
    private readonly expenseService: ExpenseTrackerService,
    private readonly fuelService: FuelExpenseService,
    private readonly bankTransferService: BankTransferService,
    private readonly emailService: EmailService,
    private readonly pdfService: PaymentSheetPdfService,
  ) {}

  // ─────────────────────────── config / stage helpers ───────────────────────────

  private async getApprovalFlow(em?: EntityManager): Promise<ApprovalStageConfig[]> {
    try {
      const rows = await this.repo.raw(
        `
        SELECT cs.value AS value
        FROM config_settings cs
        JOIN configurations c ON c.id = cs."configId"
        WHERE c.key = $1 AND cs."isActive" = true AND cs."deletedAt" IS NULL
        ORDER BY cs."createdAt" DESC
        LIMIT 1
        `,
        [PAYMENT_SHEET_CONFIG.APPROVAL_FLOW_KEY],
        em,
      );
      const value = rows?.[0]?.value;
      const parsed = typeof value === 'string' ? JSON.parse(value) : value;
      if (Array.isArray(parsed) && parsed.length) return parsed as ApprovalStageConfig[];
    } catch (e) {
      this.logger.warn(`Falling back to default approval flow: ${e}`);
    }
    return DEFAULT_APPROVAL_FLOW;
  }

  private stageConfig(flow: ApprovalStageConfig[], stage: string | null) {
    return flow.find((s) => s.stage === stage) ?? null;
  }

  private nextStage(flow: ApprovalStageConfig[], stage: string | null): ApprovalStageConfig | null {
    const idx = flow.findIndex((s) => s.stage === stage);
    if (idx < 0 || idx + 1 >= flow.length) return null;
    return flow[idx + 1];
  }

  /** Throws unless the acting user owns the sheet's current stage. */
  private assertStageAuthority(
    flow: ApprovalStageConfig[],
    sheet: PaymentSheetEntity,
    user: ActingUser,
  ): ApprovalStageConfig {
    const cfg = this.stageConfig(flow, sheet.currentStage);
    if (!cfg) throw new BadRequestException(PAYMENT_SHEET_ERRORS.NOT_EDITABLE_STAGE);
    if (user.activeRole !== cfg.role && user.activeRole !== SUPER_ADMIN) {
      throw new ForbiddenException(PAYMENT_SHEET_ERRORS.NOT_EDITABLE_STAGE);
    }
    return cfg;
  }

  private async generateSheetNumber(financialYear: string, em: EntityManager): Promise<string> {
    const count = await this.repo.countSheets({ where: { financialYear } }, em);
    const seq = String(count + 1).padStart(4, '0');
    return `${PAYMENT_SHEET_DEFAULTS.SHEET_NUMBER_PREFIX}/${financialYear}/${seq}`;
  }

  // ─────────────────────────── verification helpers ───────────────────────────

  private stageIndex(flow: ApprovalStageConfig[], stage: string | null): number {
    return flow.findIndex((s) => s.stage === stage);
  }

  /** True if the item is verified by a stage LATER than the actor's current stage. */
  private async isEditLocked(
    itemId: string,
    currentStage: string | null,
    flow: ApprovalStageConfig[],
    em?: EntityManager,
  ): Promise<boolean> {
    const actorIdx = this.stageIndex(flow, currentStage);
    if (actorIdx < 0) return false;
    const rows = await this.repo.findVerifications({ where: { itemId } }, em);
    return rows.some((v) => {
      const vIdx = this.stageIndex(flow, v.stage);
      return vIdx > actorIdx;
    });
  }

  private async assertNotEditLocked(
    itemId: string,
    currentStage: string | null,
    flow: ApprovalStageConfig[],
    em?: EntityManager,
  ) {
    if (await this.isEditLocked(itemId, currentStage, flow, em)) {
      throw new ForbiddenException(PAYMENT_SHEET_ERRORS.EDIT_LOCKED_VERIFIED);
    }
  }

  private async clearItemVerifications(itemId: string, em: EntityManager) {
    await this.repo.deleteVerificationsByItem(itemId, em);
  }

  /** Idempotently record a verification row for (item, stage). */
  private async upsertVerification(
    item: PaymentSheetItemEntity,
    stage: string,
    userId: string,
    em: EntityManager,
  ): Promise<boolean> {
    const existing = await this.repo.findVerification({ where: { itemId: item.id, stage } }, em);
    if (existing) return false;
    await this.repo.createVerification(
      {
        itemId: item.id,
        paymentSheetId: item.paymentSheetId,
        stage,
        verifiedBy: userId,
        createdBy: userId,
      },
      em,
    );
    return true;
  }

  /** After a reviewer edits a line, their edit counts as their own verification (Q3). */
  private async autoVerifyOnEdit(
    item: PaymentSheetItemEntity,
    sheet: PaymentSheetEntity,
    flow: ApprovalStageConfig[],
    user: ActingUser,
    em: EntityManager,
  ) {
    const cfg = this.stageConfig(flow, sheet.currentStage);
    if (cfg?.verifyItems && sheet.currentStage) {
      await this.upsertVerification(item, sheet.currentStage, user.id, em);
    }
  }

  // ─────────────────────────── live pending recompute ───────────────────────────

  private async computeLivePending(
    item: PaymentSheetItemEntity,
    em?: EntityManager,
  ): Promise<number> {
    if (item.sourceType === PaymentSourceType.EXPENSE && item.userId) {
      const { query, params } = userExpensePendingQuery(item.userId);
      const r = await this.repo.raw(query, params, em);
      return Math.max(0, Number(r?.[0]?.pending ?? 0));
    }
    if (item.sourceType === PaymentSourceType.FUEL_EXPENSE && item.userId) {
      const { query, params } = userFuelPendingQuery(item.userId);
      const r = await this.repo.raw(query, params, em);
      return Math.max(0, Number(r?.[0]?.pending ?? 0));
    }
    // Vendor: Σ transferable of still-un-transferred, approved allocations.
    const allocations = await this.repo.findAllocations(
      { where: { itemId: item.id, deletedAt: IsNull() } },
      em,
    );
    if (!allocations.length) return 0;
    const ids = allocations.map((a) => a.bookPaymentId);
    const { query, params } = bookPaymentsTransferableQuery(ids);
    const rows = await this.repo.raw(query, params, em);
    return rows
      .filter((r: any) => r.hasTransfer === false && r.approvalStatus === 'APPROVED')
      .reduce((s: number, r: any) => s + Number(r.transferable), 0);
  }

  // ─────────────────────────── item building ───────────────────────────

  private async buildItem(
    sheetId: string,
    input: PaymentSheetItemInputDto,
    createdBy: string,
    em: EntityManager,
  ): Promise<{
    item: PaymentSheetItemEntity;
    allocations: Array<{ bookPaymentId: string; allocatedAmount: number }>;
  }> {
    if (input.beneficiaryType === BeneficiaryType.VENDOR) {
      if (input.sourceType !== PaymentSourceType.VENDOR_PAYMENT) {
        throw new BadRequestException('Vendor items must use sourceType VENDOR_PAYMENT');
      }
      const ids = input.bookPaymentIds ?? [];
      if (!ids.length) throw new BadRequestException('bookPaymentIds required for a vendor item');

      const { query, params } = bookPaymentsTransferableQuery(ids);
      const rows = await this.repo.raw(query, params, em);
      if (rows.length !== ids.length) {
        throw new BadRequestException('One or more book payments not found');
      }
      let pending = 0;
      const allocations: Array<{ bookPaymentId: string; allocatedAmount: number }> = [];
      for (const r of rows) {
        if (r.vendorId !== input.vendorId) {
          throw new BadRequestException('A book payment does not belong to this vendor');
        }
        if (r.approvalStatus !== 'APPROVED' || r.hasTransfer !== false) {
          throw new BadRequestException(
            'A book payment is not eligible (must be approved & un-transferred)',
          );
        }
        const transferable = Number(r.transferable);
        pending += transferable;
        allocations.push({ bookPaymentId: r.bookPaymentId, allocatedAmount: transferable });
      }
      // Vendor amount is allocation-based and DERIVED from the selected book payments.
      // requestedAmount is optional for vendors; if the client sends it, treat it as a
      // checksum and reject a mismatch (catches stale UI).
      if (input.requestedAmount !== undefined && input.requestedAmount !== null) {
        if (Math.abs(Number(input.requestedAmount) - pending) > 0.01) {
          throw new BadRequestException(
            `Vendor amount must equal the sum of selected book payments (${pending.toFixed(2)})`,
          );
        }
      }
      if (pending <= 0) {
        throw new BadRequestException(PAYMENT_SHEET_ERRORS.AMOUNT_MUST_BE_POSITIVE);
      }
      const requested = pending;
      const bank = await this.repo.raw(
        `SELECT "accountHolderName", "bankName", "accountNumber", "ifscCode" FROM "vendors" WHERE id = $1`,
        [input.vendorId],
        em,
      );
      const item = await this.repo.createItem(
        {
          paymentSheetId: sheetId,
          beneficiaryType: BeneficiaryType.VENDOR,
          vendorId: input.vendorId,
          userId: null,
          sourceType: PaymentSourceType.VENDOR_PAYMENT,
          pendingSnapshot: pending,
          requestedAmount: requested,
          currentAmount: requested,
          bankSnapshot: bank?.[0]
            ? {
                accountHolderName: bank[0].accountHolderName ?? null,
                bankName: bank[0].bankName ?? null,
                accountNumber: bank[0].accountNumber ?? null,
                ifscCode: bank[0].ifscCode ?? null,
              }
            : null,
          itemStatus: PaymentSheetItemStatus.PENDING,
          createdBy,
        },
        em,
      );
      return { item, allocations };
    }

    // USER item (expense / fuel)
    if (!input.userId) throw new BadRequestException('userId required for a user item');
    if (
      input.sourceType !== PaymentSourceType.EXPENSE &&
      input.sourceType !== PaymentSourceType.FUEL_EXPENSE
    ) {
      throw new BadRequestException('User items must use EXPENSE or FUEL_EXPENSE');
    }
    const requested = Number(input.requestedAmount);
    if (!(requested > 0)) {
      throw new BadRequestException(PAYMENT_SHEET_ERRORS.AMOUNT_MUST_BE_POSITIVE);
    }
    const pendingQuery =
      input.sourceType === PaymentSourceType.EXPENSE
        ? userExpensePendingQuery(input.userId)
        : userFuelPendingQuery(input.userId);
    const pr = await this.repo.raw(pendingQuery.query, pendingQuery.params, em);
    const pending = Math.max(0, Number(pr?.[0]?.pending ?? 0));
    if (requested > pending + 0.01) {
      throw new BadRequestException(PAYMENT_SHEET_ERRORS.AMOUNT_EXCEEDS_PENDING);
    }
    const bank = await this.repo.raw(
      `SELECT "bankHolderName", "bankName", "accountNumber", "ifscCode" FROM "users" WHERE id = $1`,
      [input.userId],
      em,
    );
    const item = await this.repo.createItem(
      {
        paymentSheetId: sheetId,
        beneficiaryType: BeneficiaryType.USER,
        userId: input.userId,
        vendorId: null,
        sourceType: input.sourceType,
        pendingSnapshot: pending,
        requestedAmount: requested,
        currentAmount: requested,
        bankSnapshot: bank?.[0]
          ? {
              accountHolderName: bank[0].bankHolderName ?? null,
              bankName: bank[0].bankName ?? null,
              accountNumber: bank[0].accountNumber ?? null,
              ifscCode: bank[0].ifscCode ?? null,
            }
          : null,
        itemStatus: PaymentSheetItemStatus.PENDING,
        createdBy,
      },
      em,
    );
    return { item, allocations: [] };
  }

  private async persistAllocations(
    itemId: string,
    allocations: Array<{ bookPaymentId: string; allocatedAmount: number }>,
    createdBy: string,
    em: EntityManager,
  ) {
    for (const a of allocations) {
      await this.repo.createAllocation(
        { itemId, bookPaymentId: a.bookPaymentId, allocatedAmount: a.allocatedAmount, createdBy },
        em,
      );
    }
  }

  private assertNoDuplicate(existing: PaymentSheetItemEntity[], input: PaymentSheetItemInputDto) {
    const dup = existing.find(
      (i) =>
        i.sourceType === input.sourceType &&
        ((input.beneficiaryType === BeneficiaryType.USER && i.userId === input.userId) ||
          (input.beneficiaryType === BeneficiaryType.VENDOR && i.vendorId === input.vendorId)),
    );
    if (dup) throw new BadRequestException(PAYMENT_SHEET_ERRORS.DUPLICATE_BENEFICIARY);
  }

  private async recomputeTotals(sheetId: string, em: EntityManager) {
    const items = await this.repo.findItems(
      { where: { paymentSheetId: sheetId, deletedAt: IsNull() } },
      em,
    );
    const live = items.filter((i) => i.itemStatus !== PaymentSheetItemStatus.REJECTED);
    const totalRequested = live.reduce((s, i) => s + Number(i.requestedAmount), 0);
    const totalCurrent = live.reduce((s, i) => s + Number(i.currentAmount), 0);
    const totalPaid = items.reduce((s, i) => s + Number(i.paidAmount ?? 0), 0);
    await this.repo.updateSheet(
      { id: sheetId },
      {
        totalRequestedAmount: totalRequested,
        totalCurrentAmount: totalCurrent,
        totalPaidAmount: totalPaid,
      },
      em,
    );
  }

  private async addHistory(
    item: PaymentSheetItemEntity,
    action: ItemHistoryAction,
    stage: string | null,
    changedBy: string,
    em: EntityManager,
    opts: {
      previousAmount?: number | null;
      newAmount?: number | null;
      reason?: string | null;
    } = {},
  ) {
    await this.repo.addHistory(
      {
        itemId: item.id,
        paymentSheetId: item.paymentSheetId,
        stage,
        action,
        previousAmount: opts.previousAmount ?? null,
        newAmount: opts.newAmount ?? null,
        reason: opts.reason ?? null,
        createdBy: changedBy,
      },
      em,
    );
  }

  private async addStageLog(
    sheet: PaymentSheetEntity,
    action: StageAction,
    toStage: string | null,
    user: ActingUser,
    remarks: string | null,
    em: EntityManager,
  ) {
    await this.repo.addStageLog(
      {
        paymentSheetId: sheet.id,
        fromStage: sheet.currentStage,
        toStage,
        action,
        actedBy: user.id,
        actedRole: user.activeRole,
        remarks,
        createdBy: user.id,
      },
      em,
    );
  }

  // ─────────────────────────── create / read / meta ───────────────────────────

  async create(dto: CreatePaymentSheetDto, user: ActingUser) {
    return await this.dataSource.transaction(async (em) => {
      const financialYear = getFinancialYear(new Date());
      const sheetNumber = await this.generateSheetNumber(financialYear, em);
      const sheet = await this.repo.createSheet(
        {
          sheetNumber,
          title: dto.title ?? null,
          remarks: dto.remarks ?? null,
          financialYear,
          status: PaymentSheetStatus.DRAFT,
          currentStage: PaymentSheetStage.INITIATION,
          createdBy: user.id,
        },
        em,
      );

      const seen: PaymentSheetItemEntity[] = [];
      for (const input of dto.items) {
        this.assertNoDuplicate(seen, input);
        const { item, allocations } = await this.buildItem(sheet.id, input, user.id, em);
        await this.persistAllocations(item.id, allocations, user.id, em);
        await this.addHistory(
          item,
          ItemHistoryAction.ITEM_ADDED,
          PaymentSheetStage.INITIATION,
          user.id,
          em,
          {
            newAmount: Number(item.requestedAmount),
          },
        );
        seen.push(item);
      }

      await this.recomputeTotals(sheet.id, em);
      return { message: PAYMENT_SHEET_RESPONSES.CREATED, id: sheet.id, sheetNumber };
    });
  }

  async findAll(query: QueryPaymentSheetDto) {
    const {
      page = 1,
      pageSize,
      sortOrder = SortOrder.DESC,
      status,
      currentStage,
      financialYear,
      paidFromAccountId,
      paidFromAccountName,
      hasPaidFromAccount,
    } = query;
    const where: any = { deletedAt: IsNull() };
    if (status) where.status = status;
    if (currentStage) where.currentStage = currentStage;
    if (financialYear) where.financialYear = financialYear;

    // paidFromAccountId/Name/hasPaidFromAccount live on payment_sheet_items, not the sheet
    // header — resolve to matching sheet ids first (sheets with at least one matching line).
    if (paidFromAccountId || paidFromAccountName || hasPaidFromAccount !== undefined) {
      const conditions: string[] = ['i."deletedAt" IS NULL'];
      const params: any[] = [];
      if (paidFromAccountId) {
        params.push(paidFromAccountId);
        conditions.push(`i."paidFromAccountId" = $${params.length}`);
      }
      if (paidFromAccountName) {
        params.push(`%${paidFromAccountName}%`);
        conditions.push(`LOWER(cba."accountName") LIKE LOWER($${params.length})`);
      }
      if (hasPaidFromAccount === true) conditions.push(`i."paidFromAccountId" IS NOT NULL`);
      else if (hasPaidFromAccount === false) conditions.push(`i."paidFromAccountId" IS NULL`);

      const rows = await this.repo.raw(
        `
        SELECT DISTINCT i."paymentSheetId" AS id
        FROM "payment_sheet_items" i
        LEFT JOIN "company_bank_accounts" cba ON cba."id" = i."paidFromAccountId"
        WHERE ${conditions.join(' AND ')}
        `,
        params,
      );
      const matchingIds = rows.map((r: any) => r.id);
      if (!matchingIds.length) return { records: [], totalRecords: 0 };
      where.id = In(matchingIds);
    }

    const [records, totalRecords] = await Promise.all([
      this.repo.findSheets({
        where,
        order: { createdAt: sortOrder as SortOrder },
        ...(pageSize !== undefined ? { skip: (page - 1) * pageSize, take: pageSize } : {}),
      }),
      this.repo.countSheets({ where }),
    ]);
    return { records, totalRecords };
  }

  /**
   * Per-item settlement breakdown for GET :id, in front-of-house terms:
   *  - actualDueAmount: what's outstanding, independent of this sheet
   *  - payableAmount:   what this sheet line is paying out
   *  - remainingAmount: actualDueAmount − payableAmount, what stays due after this payment
   *
   * Vendor items: the per-invoice breakdown (with company/project/city/state) is nested
   * inside each `bookPaymentAllocations[].invoice`, mirroring the real chain
   * (vendor item → book payment → invoice); item-level amounts are the sum across them.
   * Expense/fuel items have no single invoice/site to attach that to, so they only
   * get the three summary amounts.
   */
  private buildSettlementBreakdown(
    item: PaymentSheetItemEntity,
    bpDetailMap: Map<string, any>,
    expensePendingMap: Map<string, number>,
    fuelPendingMap: Map<string, number>,
    adviceMap: Map<string, any> = new Map(),
  ) {
    if (item.beneficiaryType === BeneficiaryType.VENDOR) {
      // Real chain: vendor item → book payment (allocation) → invoice. So the invoice
      // detail is nested inside each book-payment allocation, not flattened onto the item.
      const bookPaymentAllocations = (item.bookPaymentAllocations ?? []).map((alloc) => {
        const row = bpDetailMap.get(alloc.bookPaymentId);
        const payableAmount = Number(alloc.allocatedAmount);
        let invoice: {
          invoiceId: string;
          invoiceNumber: string;
          invoiceDate: Date;
          actualDueAmount: number;
          payableAmount: number;
          remainingAmount: number;
          companyName: string;
          projectName: string;
          city: string;
          state: string;
        } | null = null;
        if (row) {
          const netPayable = Number(row.invoiceNetPayableAmount);
          const bookedTotal = Number(row.invoiceBookedTotal);
          invoice = {
            invoiceId: row.invoiceId,
            invoiceNumber: row.invoiceNumber,
            invoiceDate: row.invoiceDate,
            actualDueAmount: netPayable - (bookedTotal - payableAmount),
            payableAmount,
            remainingAmount: Number(row.invoicePendingToBook),
            companyName: row.companyName,
            projectName: row.siteName,
            city: row.siteCity,
            state: row.siteState,
          };
        }
        const advice = alloc.bankTransferId ? adviceMap.get(alloc.bankTransferId) : null;
        return {
          id: alloc.id,
          bookPaymentId: alloc.bookPaymentId,
          allocatedAmount: payableAmount,
          bankTransferId: alloc.bankTransferId ?? null,
          invoice,
          paymentAdvice: advice
            ? {
                id: advice.id,
                referenceNumber: advice.referenceNumber,
                generatedAt: advice.generatedAt,
                pdfKey: advice.pdfKey ?? null,
              }
            : null,
        };
      });

      // Item-level totals = sum across the allocations that resolved an invoice.
      const withInvoice = bookPaymentAllocations.filter((a) => a.invoice);
      return {
        bookPaymentAllocations,
        actualDueAmount: withInvoice.reduce((s, a) => s + (a.invoice as any).actualDueAmount, 0),
        payableAmount: withInvoice.reduce((s, a) => s + (a.invoice as any).payableAmount, 0),
        remainingAmount: withInvoice.reduce((s, a) => s + (a.invoice as any).remainingAmount, 0),
      };
    }

    const pendingMap =
      item.sourceType === PaymentSourceType.EXPENSE ? expensePendingMap : fuelPendingMap;
    const actualDueAmount = Math.max(0, pendingMap.get(item.userId as string) ?? 0);
    const payableAmount = Number(item.currentAmount);
    return {
      actualDueAmount,
      payableAmount,
      remainingAmount: Math.max(0, actualDueAmount - payableAmount),
    };
  }

  async findOne(id: string) {
    const sheet = await this.repo.findSheet({ where: { id, deletedAt: IsNull() } });
    if (!sheet) throw new NotFoundException(PAYMENT_SHEET_ERRORS.NOT_FOUND);
    const items = await this.repo.findItems({
      where: { paymentSheetId: id, deletedAt: IsNull() },
      relations: ['bookPaymentAllocations', 'paidFromAccount'],
      order: { createdAt: 'ASC' },
    });
    const stageLogs = await this.repo.findStageLogs({
      where: { paymentSheetId: id },
      order: { createdAt: 'ASC' },
    });
    const history = await this.repo.findHistory({
      where: { paymentSheetId: id },
      order: { createdAt: 'ASC' },
    });

    // Per-item verification rows (grouped by item) + who verified.
    const verifications = await this.repo.findVerifications({ where: { paymentSheetId: id } });
    const verByItem = new Map<string, typeof verifications>();
    for (const v of verifications) {
      const arr = verByItem.get(v.itemId) ?? [];
      arr.push(v);
      verByItem.set(v.itemId, arr);
    }

    // Enrich each item with beneficiary + verifier identities (single batched user fetch).
    const userIds = [
      ...new Set(
        [
          ...items.filter((i) => i.userId).map((i) => i.userId as string),
          ...items.filter((i) => i.rejectedBy).map((i) => i.rejectedBy as string),
          ...verifications.map((v) => v.verifiedBy),
          sheet.createdBy, // who created the sheet
          ...history.map((h) => h.createdBy), // who made each item-history change
          ...stageLogs.map((s) => s.createdBy), // who performed each stage transition
        ].filter((x): x is string => !!x),
      ),
    ];
    const vendorIds = [...new Set(items.filter((i) => i.vendorId).map((i) => i.vendorId))];

    // Settlement breakdown inputs: book-payment/invoice detail for vendor items,
    // batched live-pending for expense/fuel items.
    const bookPaymentIds = [
      ...new Set(
        items
          .filter((i) => i.beneficiaryType === BeneficiaryType.VENDOR)
          .flatMap((i) => (i.bookPaymentAllocations ?? []).map((a) => a.bookPaymentId)),
      ),
    ];
    // Bank transfers behind disbursed vendor allocations → their auto-generated payment advices.
    const bankTransferIds = [
      ...new Set(
        items
          .filter((i) => i.beneficiaryType === BeneficiaryType.VENDOR)
          .flatMap((i) =>
            (i.bookPaymentAllocations ?? [])
              .map((a) => a.bankTransferId)
              .filter((x): x is string => !!x),
          ),
      ),
    ];
    const expenseUserIds = [
      ...new Set(
        items
          .filter((i) => i.sourceType === PaymentSourceType.EXPENSE && i.userId)
          .map((i) => i.userId as string),
      ),
    ];
    const fuelUserIds = [
      ...new Set(
        items
          .filter((i) => i.sourceType === PaymentSourceType.FUEL_EXPENSE && i.userId)
          .map((i) => i.userId as string),
      ),
    ];

    const [userRows, vendorRows, bpDetailRows, expensePendingRows, fuelPendingRows, adviceRows] =
      await Promise.all([
        userIds.length
          ? this.repo.raw(
              `SELECT id, "firstName", "lastName", "email", "employeeId" FROM users WHERE id = ANY($1)`,
              [userIds],
            )
          : Promise.resolve([]),
        vendorIds.length
          ? this.repo.raw(
              `SELECT id, name, email, "contactNumber", city, state FROM vendors WHERE id = ANY($1)`,
              [vendorIds],
            )
          : Promise.resolve([]),
        bookPaymentIds.length
          ? (() => {
              const q = bookPaymentInvoiceDetailQuery(bookPaymentIds);
              return this.repo.raw(q.query, q.params);
            })()
          : Promise.resolve([]),
        expenseUserIds.length
          ? (() => {
              const q = usersExpensePendingQuery(expenseUserIds);
              return this.repo.raw(q.query, q.params);
            })()
          : Promise.resolve([]),
        fuelUserIds.length
          ? (() => {
              const q = usersFuelPendingQuery(fuelUserIds);
              return this.repo.raw(q.query, q.params);
            })()
          : Promise.resolve([]),
        bankTransferIds.length
          ? this.repo.raw(
              `SELECT id, "bankTransferId", "referenceNumber", "generatedAt", "pdfKey"
               FROM payment_advices WHERE "bankTransferId" = ANY($1) AND "deletedAt" IS NULL`,
              [bankTransferIds],
            )
          : Promise.resolve([]),
      ]);
    const userMap = new Map<string, any>(userRows.map((u: any) => [u.id, u]));
    const vendorMap = new Map<string, any>(vendorRows.map((v: any) => [v.id, v]));
    const bpDetailMap = new Map<string, any>(bpDetailRows.map((r: any) => [r.bookPaymentId, r]));
    // bankTransferId → payment advice (1:1). Attached per vendor allocation in the breakdown.
    const adviceMap = new Map<string, any>(adviceRows.map((r: any) => [r.bankTransferId, r]));
    const expensePendingMap = new Map<string, number>(
      expensePendingRows.map((r: any) => [r.userId, Number(r.pending)]),
    );
    const fuelPendingMap = new Map<string, number>(
      fuelPendingRows.map((r: any) => [r.userId, Number(r.pending)]),
    );
    const nameOf = (uid: string) => {
      const u = userMap.get(uid);
      return u ? [u.firstName, u.lastName].filter(Boolean).join(' ') : null;
    };
    // Compact actor object for createdBy fields (sheet / history / stage logs).
    const userObj = (uid: string | null | undefined) => {
      const u = uid ? userMap.get(uid) : null;
      return u
        ? {
            id: u.id,
            firstName: u.firstName,
            lastName: u.lastName,
            email: u.email ?? null,
            employeeId: u.employeeId ?? null,
          }
        : null;
    };

    const flow = await this.getApprovalFlow();
    const currentStage = sheet.currentStage;

    const enrichedItems = items.map((i) => {
      const u = i.userId ? userMap.get(i.userId) : null;
      const v = i.vendorId ? vendorMap.get(i.vendorId) : null;
      const vers = (verByItem.get(i.id) ?? []).map((row) => ({
        stage: row.stage,
        verifiedBy: row.verifiedBy,
        verifiedByName: nameOf(row.verifiedBy),
        verifiedAt: row.verifiedAt,
      }));
      const verifiedStages = vers.map((x) => x.stage);
      return {
        ...i,
        user: u
          ? {
              id: u.id,
              firstName: u.firstName,
              lastName: u.lastName,
              fullName: [u.firstName, u.lastName].filter(Boolean).join(' '),
              email: u.email ?? null,
              employeeId: u.employeeId ?? null,
            }
          : null,
        vendor: v
          ? {
              id: v.id,
              name: v.name,
              email: v.email ?? null,
              contactNumber: v.contactNumber ?? null,
              city: v.city ?? null,
              state: v.state ?? null,
            }
          : null,
        verifications: vers,
        verifiedStages,
        isVerifiedForCurrentStage: currentStage ? verifiedStages.includes(currentStage) : false,
        rejectDetail: i.rejectStage
          ? {
              stage: i.rejectStage,
              rejectedBy: (() => {
                const rj = i.rejectedBy ? userMap.get(i.rejectedBy) : null;
                return rj
                  ? {
                      id: rj.id,
                      firstName: rj.firstName,
                      lastName: rj.lastName,
                      email: rj.email ?? null,
                      employeeId: rj.employeeId ?? null,
                    }
                  : null;
              })(),
              rejectedAt: i.rejectedAt,
              reason: i.rejectReason,
            }
          : null,
        paidFromAccount: i.paidFromAccount
          ? {
              id: i.paidFromAccount.id,
              accountName: i.paidFromAccount.accountName,
              accountHolderName: i.paidFromAccount.accountHolderName,
              bankName: i.paidFromAccount.bankName,
              accountNumber: i.paidFromAccount.accountNumber,
              ifscCode: i.paidFromAccount.ifscCode,
              branchName: i.paidFromAccount.branchName ?? null,
            }
          : null,
        ...this.buildSettlementBreakdown(
          i,
          bpDetailMap,
          expensePendingMap,
          fuelPendingMap,
          adviceMap,
        ),
      };
    });

    // Per-current-stage verification summary (only when the current stage verifies).
    let verificationSummary: {
      stage: string;
      verified: number;
      total: number;
      allVerified: boolean;
    } | null = null;
    const currentCfg = this.stageConfig(flow, currentStage);
    if (currentCfg?.verifyItems && currentStage) {
      const active = items.filter((i) => i.itemStatus !== PaymentSheetItemStatus.REJECTED);
      const verified = active.filter((i) =>
        (verByItem.get(i.id) ?? []).some((row) => row.stage === currentStage),
      ).length;
      verificationSummary = {
        stage: currentStage,
        verified,
        total: active.length,
        allVerified: verified === active.length,
      };
    }

    const stageLogsEnriched = stageLogs.map((s) => ({ ...s, createdByUser: userObj(s.createdBy) }));
    const historyEnriched = history.map((h) => ({ ...h, createdByUser: userObj(h.createdBy) }));

    return {
      ...sheet,
      createdByUser: userObj(sheet.createdBy), // who created the payment sheet
      items: enrichedItems,
      stageLogs: stageLogsEnriched,
      history: historyEnriched,
      verificationSummary,
    };
  }

  private async loadEditableSheet(id: string, em: EntityManager) {
    const sheet = await this.repo.findSheetForUpdate(id, em);
    if (!sheet) throw new NotFoundException(PAYMENT_SHEET_ERRORS.NOT_FOUND);
    return sheet;
  }

  async updateMeta(id: string, dto: UpdatePaymentSheetDto, user: ActingUser) {
    return await this.dataSource.transaction(async (em) => {
      const sheet = await this.loadEditableSheet(id, em);
      if (
        ![PaymentSheetStatus.DRAFT, PaymentSheetStatus.RETURNED].includes(
          sheet.status as PaymentSheetStatus,
        )
      ) {
        throw new BadRequestException(PAYMENT_SHEET_ERRORS.NOT_DRAFT);
      }
      await this.repo.updateSheet(
        { id },
        {
          title: dto.title ?? sheet.title,
          remarks: dto.remarks ?? sheet.remarks,
          updatedBy: user.id,
        },
        em,
      );
      return { message: PAYMENT_SHEET_RESPONSES.UPDATED };
    });
  }

  // ─────────────────────────── item add / edit / remove ───────────────────────────

  async addItems(id: string, dto: AddPaymentSheetItemsDto, user: ActingUser) {
    return await this.dataSource.transaction(async (em) => {
      const sheet = await this.loadEditableSheet(id, em);
      const flow = await this.getApprovalFlow(em);

      const isDraftInitiator =
        [PaymentSheetStatus.DRAFT, PaymentSheetStatus.RETURNED].includes(
          sheet.status as PaymentSheetStatus,
        ) && sheet.currentStage === PaymentSheetStage.INITIATION;
      if (!isDraftInitiator) {
        const cfg = this.assertStageAuthority(flow, sheet, user);
        if (!cfg.addRemove)
          throw new ForbiddenException(PAYMENT_SHEET_ERRORS.ADD_REMOVE_NOT_ALLOWED);
      }

      const existing = await this.repo.findItems(
        { where: { paymentSheetId: id, deletedAt: IsNull() } },
        em,
      );
      const seen = [...existing];
      for (const input of dto.items) {
        this.assertNoDuplicate(seen, input);
        const { item, allocations } = await this.buildItem(id, input, user.id, em);
        await this.persistAllocations(item.id, allocations, user.id, em);
        await this.addHistory(item, ItemHistoryAction.ITEM_ADDED, sheet.currentStage, user.id, em, {
          newAmount: Number(item.requestedAmount),
        });
        seen.push(item);
      }
      await this.recomputeTotals(id, em);
      return { message: PAYMENT_SHEET_RESPONSES.ITEM_ADDED };
    });
  }

  async editItemAmount(id: string, itemId: string, dto: EditItemAmountDto, user: ActingUser) {
    return await this.dataSource.transaction(async (em) => {
      const sheet = await this.loadEditableSheet(id, em);
      const flow = await this.getApprovalFlow(em);
      const cfg = this.assertStageAuthority(flow, sheet, user);

      if (cfg.amountEdit === 'none') {
        throw new ForbiddenException(PAYMENT_SHEET_ERRORS.AMOUNT_EDIT_NOT_ALLOWED);
      }

      const item = await this.repo.findItem(
        { where: { id: itemId, paymentSheetId: id, deletedAt: IsNull() } },
        em,
      );
      if (!item) throw new NotFoundException(PAYMENT_SHEET_ERRORS.ITEM_NOT_FOUND);
      if (item.itemStatus === PaymentSheetItemStatus.REJECTED) {
        throw new BadRequestException(PAYMENT_SHEET_ERRORS.ITEM_ALREADY_REJECTED);
      }

      // Edit-lock: an earlier stage cannot edit a line a later stage has verified.
      await this.assertNotEditLocked(itemId, sheet.currentStage, flow, em);

      if (item.beneficiaryType === BeneficiaryType.VENDOR) {
        throw new BadRequestException(
          'Vendor amounts are allocation-based; remove the line and re-add with fewer book payments to reduce.',
        );
      }

      const newAmount = Number(dto.amount);
      if (newAmount <= 0)
        throw new BadRequestException(PAYMENT_SHEET_ERRORS.AMOUNT_MUST_BE_POSITIVE);
      const prev = Number(item.currentAmount);

      if (cfg.amountEdit === 'decrease-only') {
        if (newAmount > prev + 0.01) {
          throw new BadRequestException(PAYMENT_SHEET_ERRORS.AMOUNT_INCREASE_NOT_ALLOWED);
        }
        if (!dto.reason || !dto.reason.trim()) {
          throw new BadRequestException(PAYMENT_SHEET_ERRORS.REASON_REQUIRED);
        }
      }

      // Never exceed current live pending.
      const livePending = await this.computeLivePending(item, em);
      if (newAmount > livePending + 0.01) {
        throw new BadRequestException(PAYMENT_SHEET_ERRORS.AMOUNT_EXCEEDS_PENDING);
      }

      await this.repo.updateItem(
        { id: itemId },
        { currentAmount: newAmount, updatedBy: user.id },
        em,
      );
      await this.addHistory(item, ItemHistoryAction.AMOUNT_EDIT, sheet.currentStage, user.id, em, {
        previousAmount: prev,
        newAmount,
        reason: dto.reason ?? null,
      });
      // A changed amount clears everyone's verification of this line; the editing
      // reviewer's own edit then counts as their verification for their stage.
      if (Math.abs(newAmount - prev) > 0.01) {
        await this.clearItemVerifications(itemId, em);
      }
      await this.autoVerifyOnEdit(item, sheet, flow, user, em);
      await this.recomputeTotals(id, em);
      return { message: PAYMENT_SHEET_RESPONSES.ITEM_UPDATED };
    });
  }

  async removeItem(id: string, itemId: string, dto: StageActionDto, user: ActingUser) {
    return await this.dataSource.transaction(async (em) => {
      const sheet = await this.loadEditableSheet(id, em);
      const flow = await this.getApprovalFlow(em);

      const isDraftInitiator =
        [PaymentSheetStatus.DRAFT, PaymentSheetStatus.RETURNED].includes(
          sheet.status as PaymentSheetStatus,
        ) && sheet.currentStage === PaymentSheetStage.INITIATION;
      if (!isDraftInitiator) {
        const cfg = this.assertStageAuthority(flow, sheet, user);
        if (!cfg.addRemove)
          throw new ForbiddenException(PAYMENT_SHEET_ERRORS.ADD_REMOVE_NOT_ALLOWED);
        if (!dto.reason || !dto.reason.trim()) {
          throw new BadRequestException(PAYMENT_SHEET_ERRORS.REASON_REQUIRED);
        }
      }

      const item = await this.repo.findItem(
        { where: { id: itemId, paymentSheetId: id, deletedAt: IsNull() } },
        em,
      );
      if (!item) throw new NotFoundException(PAYMENT_SHEET_ERRORS.ITEM_NOT_FOUND);
      if (item.itemStatus === PaymentSheetItemStatus.REJECTED) {
        throw new BadRequestException(PAYMENT_SHEET_ERRORS.ITEM_ALREADY_REJECTED);
      }

      // Edit-lock: an earlier stage cannot remove a line a later stage has verified.
      await this.assertNotEditLocked(itemId, sheet.currentStage, flow, em);

      await this.addHistory(item, ItemHistoryAction.ITEM_REMOVED, sheet.currentStage, user.id, em, {
        previousAmount: Number(item.currentAmount),
        reason: dto.reason ?? null,
      });
      await this.repo.softDeleteItem({ id: itemId }, em);
      await this.recomputeTotals(id, em);
      return { message: PAYMENT_SHEET_RESPONSES.ITEM_REMOVED };
    });
  }

  // ─────────────────────────── item verification (review stages) ───────────────────────────

  private assertVerifyStage(cfg: ApprovalStageConfig, currentStage: string | null): string {
    if (!cfg.verifyItems || !currentStage) {
      throw new BadRequestException(PAYMENT_SHEET_ERRORS.NOT_A_VERIFY_STAGE);
    }
    return currentStage;
  }

  /**
   * Verify lines at the current review stage. Pass `itemIds` to verify specific lines, or
   * omit them to verify every active line. Idempotent — already-verified lines are skipped.
   */
  async verifyItems(id: string, dto: VerifyItemsDto, user: ActingUser) {
    return await this.dataSource.transaction(async (em) => {
      const sheet = await this.loadEditableSheet(id, em);
      const flow = await this.getApprovalFlow(em);
      const cfg = this.assertStageAuthority(flow, sheet, user);
      const stage = this.assertVerifyStage(cfg, sheet.currentStage);

      const items = await this.repo.findItems(
        { where: { paymentSheetId: id, deletedAt: IsNull() } },
        em,
      );
      const active = items.filter((i) => i.itemStatus !== PaymentSheetItemStatus.REJECTED);

      let targets = active;
      if (dto.itemIds?.length) {
        const byId = new Map(active.map((i) => [i.id, i]));
        const invalid = dto.itemIds.filter((x) => !byId.has(x));
        if (invalid.length) {
          throw new BadRequestException(
            `Items not on this sheet (or rejected): ${invalid.join(', ')}`,
          );
        }
        targets = dto.itemIds.map((x) => byId.get(x)!);
      }

      let verifiedCount = 0;
      for (const item of targets) {
        const created = await this.upsertVerification(item, stage, user.id, em);
        if (created) {
          verifiedCount++;
          await this.addHistory(item, ItemHistoryAction.VERIFIED, stage, user.id, em, {});
        }
      }
      return { message: PAYMENT_SHEET_RESPONSES.ITEM_VERIFIED, verifiedCount };
    });
  }

  /** Remove the current stage's verification from the listed lines. */
  async unverifyItems(id: string, dto: UnverifyItemsDto, user: ActingUser) {
    return await this.dataSource.transaction(async (em) => {
      const sheet = await this.loadEditableSheet(id, em);
      const flow = await this.getApprovalFlow(em);
      const cfg = this.assertStageAuthority(flow, sheet, user);
      const stage = this.assertVerifyStage(cfg, sheet.currentStage);

      const items = await this.repo.findItems(
        { where: { paymentSheetId: id, deletedAt: IsNull() } },
        em,
      );
      const byId = new Map(items.map((i) => [i.id, i]));
      const invalid = dto.itemIds.filter((x) => !byId.has(x));
      if (invalid.length) {
        throw new BadRequestException(`Items not on this sheet: ${invalid.join(', ')}`);
      }

      let unverifiedCount = 0;
      for (const itemId of dto.itemIds) {
        const existing = await this.repo.findVerification({ where: { itemId, stage } }, em);
        if (!existing) continue;
        await this.repo.deleteVerification(itemId, stage, em);
        await this.addHistory(
          byId.get(itemId)!,
          ItemHistoryAction.UNVERIFIED,
          stage,
          user.id,
          em,
          {},
        );
        unverifiedCount++;
      }
      return { message: PAYMENT_SHEET_RESPONSES.ITEM_UNVERIFIED, unverifiedCount };
    });
  }

  // ─────────────────────────── workflow transitions ───────────────────────────

  async submit(id: string, dto: StageActionDto, user: ActingUser) {
    const result = await this.dataSource.transaction(async (em) => {
      const sheet = await this.loadEditableSheet(id, em);
      const flow = await this.getApprovalFlow(em);

      if (
        ![PaymentSheetStatus.DRAFT, PaymentSheetStatus.RETURNED].includes(
          sheet.status as PaymentSheetStatus,
        )
      ) {
        throw new BadRequestException(PAYMENT_SHEET_ERRORS.NOT_DRAFT);
      }
      if (user.activeRole !== flow[0].role && user.activeRole !== SUPER_ADMIN) {
        throw new ForbiddenException(PAYMENT_SHEET_ERRORS.NOT_EDITABLE_STAGE);
      }
      const items = await this.repo.findItems(
        { where: { paymentSheetId: id, deletedAt: IsNull() } },
        em,
      );
      if (!items.length) throw new BadRequestException(PAYMENT_SHEET_ERRORS.EMPTY_SHEET);

      const next = this.nextStage(flow, PaymentSheetStage.INITIATION);
      if (!next) throw new BadRequestException('Approval flow has no review stage configured');

      await this.addStageLog(sheet, StageAction.SUBMIT, next.stage, user, dto.reason ?? null, em);
      await this.repo.updateSheet(
        { id },
        { status: PaymentSheetStatus.IN_REVIEW, currentStage: next.stage, updatedBy: user.id },
        em,
      );
      return { nextRole: next.role };
    });
    this.notifyStage(id, result.nextRole, StageAction.SUBMIT);
    return { message: PAYMENT_SHEET_RESPONSES.SUBMITTED };
  }

  async forward(id: string, dto: StageActionDto, user: ActingUser) {
    const result = await this.dataSource.transaction(async (em) => {
      const sheet = await this.loadEditableSheet(id, em);
      const flow = await this.getApprovalFlow(em);
      const cfg = this.assertStageAuthority(flow, sheet, user);

      // Verify gate: at a verifyItems stage, every active line must be verified for it.
      if (cfg.verifyItems && sheet.currentStage) {
        const items = await this.repo.findItems(
          { where: { paymentSheetId: id, deletedAt: IsNull() } },
          em,
        );
        const active = items.filter((i) => i.itemStatus !== PaymentSheetItemStatus.REJECTED);
        const verified = await this.repo.findVerifications(
          { where: { paymentSheetId: id, stage: sheet.currentStage } },
          em,
        );
        const verifiedItemIds = new Set(verified.map((v) => v.itemId));
        const allVerified = active.every((i) => verifiedItemIds.has(i.id));
        if (!allVerified) {
          throw new BadRequestException(PAYMENT_SHEET_ERRORS.ITEMS_NOT_ALL_VERIFIED);
        }
      }

      const next = this.nextStage(flow, sheet.currentStage);
      if (!next) throw new BadRequestException('No next stage to forward to');

      const isProcessing = next.processItems === true;
      await this.addStageLog(sheet, StageAction.FORWARD, next.stage, user, dto.reason ?? null, em);
      await this.repo.updateSheet(
        { id },
        {
          status: isProcessing ? PaymentSheetStatus.PROCESSING : PaymentSheetStatus.IN_REVIEW,
          currentStage: next.stage,
          updatedBy: user.id,
        },
        em,
      );
      return { nextRole: next.role };
    });
    this.notifyStage(id, result.nextRole, StageAction.FORWARD);
    return { message: PAYMENT_SHEET_RESPONSES.FORWARDED };
  }

  async returnSheet(id: string, dto: StageActionDto, user: ActingUser) {
    await this.dataSource.transaction(async (em) => {
      const sheet = await this.loadEditableSheet(id, em);
      const flow = await this.getApprovalFlow(em);
      const cfg = this.assertStageAuthority(flow, sheet, user);
      if (!cfg.canReturn) throw new ForbiddenException(PAYMENT_SHEET_ERRORS.NOT_EDITABLE_STAGE);
      if (!dto.reason || !dto.reason.trim()) {
        throw new BadRequestException(PAYMENT_SHEET_ERRORS.REASON_REQUIRED);
      }
      await this.addStageLog(
        sheet,
        StageAction.RETURN,
        PaymentSheetStage.INITIATION,
        user,
        dto.reason,
        em,
      );
      await this.repo.updateSheet(
        { id },
        {
          status: PaymentSheetStatus.RETURNED,
          currentStage: PaymentSheetStage.INITIATION,
          updatedBy: user.id,
        },
        em,
      );
    });
    this.notifyInitiator(id, StageAction.RETURN);
    return { message: PAYMENT_SHEET_RESPONSES.RETURNED };
  }

  async reject(id: string, dto: StageActionDto, user: ActingUser) {
    await this.dataSource.transaction(async (em) => {
      const sheet = await this.loadEditableSheet(id, em);
      const flow = await this.getApprovalFlow(em);
      const cfg = this.assertStageAuthority(flow, sheet, user);
      if (!cfg.canReject) throw new ForbiddenException(PAYMENT_SHEET_ERRORS.NOT_EDITABLE_STAGE);
      if (!dto.reason || !dto.reason.trim()) {
        throw new BadRequestException(PAYMENT_SHEET_ERRORS.REASON_REQUIRED);
      }
      await this.addStageLog(sheet, StageAction.REJECT, null, user, dto.reason, em);
      await this.repo.updateSheet(
        { id },
        { status: PaymentSheetStatus.REJECTED, currentStage: null, updatedBy: user.id },
        em,
      );
    });
    this.notifyInitiator(id, StageAction.REJECT);
    return { message: PAYMENT_SHEET_RESPONSES.REJECTED };
  }

  // ─────────────────────────── accountant item processing ───────────────────────────

  private async loadProcessingItem(
    id: string,
    itemId: string,
    user: ActingUser,
    em: EntityManager,
  ) {
    const sheet = await this.loadEditableSheet(id, em);
    const flow = await this.getApprovalFlow(em);
    const cfg = this.assertStageAuthority(flow, sheet, user);
    if (!cfg.processItems) throw new BadRequestException(PAYMENT_SHEET_ERRORS.NOT_PROCESSING_STAGE);
    const item = await this.repo.findItem(
      { where: { id: itemId, paymentSheetId: id, deletedAt: IsNull() } },
      em,
    );
    if (!item) throw new NotFoundException(PAYMENT_SHEET_ERRORS.ITEM_NOT_FOUND);
    return { sheet, item };
  }

  /**
   * Pay an item. NOTE: settlement is performed via the source modules, each of which
   * runs its own transaction (they do not accept an external EntityManager). We
   * therefore settle first, then stamp the item in a short follow-up transaction.
   * This is a documented non-atomic seam (see docs/payment-sheet-spec.md §7).
   */
  async payItem(id: string, itemId: string, dto: PayItemDto, user: ActingUser) {
    // 1. Validate (read-only) — also re-check live pending.
    let item: PaymentSheetItemEntity;
    let sheet: PaymentSheetEntity;
    {
      const ctx = await this.dataSource.transaction((em) =>
        this.loadProcessingItem(id, itemId, user, em),
      );
      sheet = ctx.sheet;
      item = ctx.item;
    }
    if (item.itemStatus !== PaymentSheetItemStatus.PENDING) {
      throw new BadRequestException(PAYMENT_SHEET_ERRORS.ITEM_NOT_PENDING);
    }
    const amount = Number(item.currentAmount);
    const livePending = await this.computeLivePending(item);
    if (amount > livePending + 0.01) {
      throw new BadRequestException(PAYMENT_SHEET_ERRORS.PENDING_CONFLICT);
    }

    const traceRef = `PS:${sheet.sheetNumber}:${item.id}`;

    // 2. Settle in the source module(s).
    let paymentRef = traceRef;
    if (item.sourceType === PaymentSourceType.EXPENSE) {
      if (!dto.paymentMode || !dto.paidDate) {
        throw new BadRequestException(PAYMENT_SHEET_ERRORS.PAYMENT_DETAILS_REQUIRED);
      }
      if (!dto.category) {
        throw new BadRequestException(PAYMENT_SHEET_ERRORS.CATEGORY_REQUIRED);
      }
      await this.expenseService.createCreditExpense({
        userId: item.userId as string,
        category: dto.category,
        description: dto.description ?? `Settled via Payment Sheet ${sheet.sheetNumber}`,
        amount,
        transactionId: dto.transactionId,
        expenseDate: new Date(dto.paidDate),
        paymentMode: dto.paymentMode,
        files: [],
        createdBy: user.id,
        sourceType: EntrySourceType.WEB,
        fileKeys: [],
        paidFromAccountId: dto.paidFromAccountId,
      } as any);
    } else if (item.sourceType === PaymentSourceType.FUEL_EXPENSE) {
      if (!dto.paymentMode || !dto.paidDate) {
        throw new BadRequestException(PAYMENT_SHEET_ERRORS.PAYMENT_DETAILS_REQUIRED);
      }
      await this.fuelService.createCreditFuelExpense({
        userId: item.userId as string,
        fuelAmount: amount,
        fillDate: new Date(dto.paidDate),
        paymentMode: dto.paymentMode,
        transactionId: dto.transactionId,
        description: dto.description ?? `Settled via Payment Sheet ${sheet.sheetNumber}`,
        files: [],
        createdBy: user.id,
        fileKeys: [],
        entrySourceType: EntrySourceType.WEB,
        paidFromAccountId: dto.paidFromAccountId,
      } as any);
    } else {
      // Vendor — create a bank transfer per allocation.
      const transfers = dto.transfers ?? [];
      const allocations = await this.repo.findAllocations({
        where: { itemId: item.id, deletedAt: IsNull() },
      });
      const pending = allocations.filter((a) => !a.bankTransferId);
      if (transfers.length !== pending.length) {
        throw new BadRequestException(PAYMENT_SHEET_ERRORS.VENDOR_ALLOCATION_MISMATCH);
      }
      const byId = new Map(transfers.map((t) => [t.bookPaymentId, t]));
      const refs: string[] = [];
      for (const alloc of pending) {
        const t = byId.get(alloc.bookPaymentId);
        if (!t) throw new BadRequestException(PAYMENT_SHEET_ERRORS.VENDOR_ALLOCATION_MISMATCH);
        // Recompute exact transferable now (bank transfer enforces exact match).
        const { query, params } = bookPaymentsTransferableQuery([alloc.bookPaymentId]);
        const r = await this.repo.raw(query, params);
        const transferable = Number(r?.[0]?.transferable ?? alloc.allocatedAmount);
        const res = await this.bankTransferService.create(
          {
            partyType: PartyType.PURCHASE,
            bookPaymentId: alloc.bookPaymentId,
            utrNumber: t.utrNumber,
            transferDate: t.transferDate,
            transferAmount: transferable,
            proofFileKey: t.proofFileKey,
            proofFileName: t.proofFileName,
            remarks: dto.remarks,
            paidFromAccountId: dto.paidFromAccountId,
          } as any,
          user.id,
        );
        await this.repo.updateAllocation({ id: alloc.id }, { bankTransferId: res.id });
        refs.push(res.id);
      }
      paymentRef = refs.join(',');
    }

    // 3. Stamp the item + roll up + maybe complete.
    await this.dataSource.transaction(async (em) => {
      const fresh = await this.repo.findItem(
        { where: { id: itemId }, withDeleted: false } as any,
        em,
      );
      if (!fresh) throw new NotFoundException(PAYMENT_SHEET_ERRORS.ITEM_NOT_FOUND);
      await this.repo.updateItem(
        { id: itemId },
        {
          itemStatus: PaymentSheetItemStatus.PAID,
          paidAmount: amount,
          paidAt: new Date(),
          paymentRef,
          paidFromAccountId: dto.paidFromAccountId ?? null,
          updatedBy: user.id,
        },
        em,
      );
      await this.addHistory(
        fresh,
        ItemHistoryAction.PAID,
        PaymentSheetStage.PROCESSING,
        user.id,
        em,
        {
          previousAmount: amount,
          newAmount: amount,
          reason: paymentRef,
        },
      );
      await this.recomputeTotals(id, em);
      await this.maybeComplete(id, user, em);
    });

    return { message: PAYMENT_SHEET_RESPONSES.ITEM_PAID, paymentRef };
  }

  async holdItem(id: string, itemId: string, dto: StageActionDto, user: ActingUser) {
    return await this.dataSource.transaction(async (em) => {
      const { item } = await this.loadProcessingItem(id, itemId, user, em);
      if (item.itemStatus !== PaymentSheetItemStatus.PENDING) {
        throw new BadRequestException(PAYMENT_SHEET_ERRORS.ITEM_NOT_PENDING);
      }
      if (!dto.reason || !dto.reason.trim()) {
        throw new BadRequestException(PAYMENT_SHEET_ERRORS.REASON_REQUIRED);
      }
      await this.repo.updateItem(
        { id: itemId },
        {
          itemStatus: PaymentSheetItemStatus.HOLD,
          holdReason: dto.reason,
          heldBy: user.id,
          updatedBy: user.id,
        },
        em,
      );
      await this.addHistory(
        item,
        ItemHistoryAction.HOLD,
        PaymentSheetStage.PROCESSING,
        user.id,
        em,
        {
          reason: dto.reason,
        },
      );
      return { message: PAYMENT_SHEET_RESPONSES.ITEM_HELD };
    });
  }

  async releaseItem(id: string, itemId: string, user: ActingUser) {
    return await this.dataSource.transaction(async (em) => {
      const { item } = await this.loadProcessingItem(id, itemId, user, em);
      if (item.itemStatus !== PaymentSheetItemStatus.HOLD) {
        throw new BadRequestException(PAYMENT_SHEET_ERRORS.ITEM_NOT_ON_HOLD);
      }
      if (item.heldBy && item.heldBy !== user.id && user.activeRole !== SUPER_ADMIN) {
        throw new ForbiddenException(PAYMENT_SHEET_ERRORS.HOLD_NOT_OWNER);
      }
      await this.repo.updateItem(
        { id: itemId },
        {
          itemStatus: PaymentSheetItemStatus.PENDING,
          holdReason: null,
          heldBy: null,
          updatedBy: user.id,
        },
        em,
      );
      await this.addHistory(
        item,
        ItemHistoryAction.RELEASE,
        PaymentSheetStage.PROCESSING,
        user.id,
        em,
        {},
      );
      return { message: PAYMENT_SHEET_RESPONSES.ITEM_RELEASED };
    });
  }

  async rejectItem(id: string, itemId: string, dto: StageActionDto, user: ActingUser) {
    const res = await this.dataSource.transaction(async (em) => {
      // Reject is allowed at any stage flagged rejectItems (HR/Admin review) or processItems
      // (accountant). assertStageAuthority already restricts to the current stage's role.
      const sheet = await this.loadEditableSheet(id, em);
      const flow = await this.getApprovalFlow(em);
      const cfg = this.assertStageAuthority(flow, sheet, user);
      if (!cfg.processItems && !cfg.rejectItems) {
        throw new BadRequestException(PAYMENT_SHEET_ERRORS.REJECT_NOT_ALLOWED_STAGE);
      }
      const item = await this.repo.findItem(
        { where: { id: itemId, paymentSheetId: id, deletedAt: IsNull() } },
        em,
      );
      if (!item) throw new NotFoundException(PAYMENT_SHEET_ERRORS.ITEM_NOT_FOUND);
      if (
        item.itemStatus !== PaymentSheetItemStatus.PENDING &&
        item.itemStatus !== PaymentSheetItemStatus.HOLD
      ) {
        throw new BadRequestException(PAYMENT_SHEET_ERRORS.ITEM_NOT_PENDING);
      }
      if (!dto.reason || !dto.reason.trim()) {
        throw new BadRequestException(PAYMENT_SHEET_ERRORS.REASON_REQUIRED);
      }
      await this.repo.updateItem(
        { id: itemId },
        {
          itemStatus: PaymentSheetItemStatus.REJECTED,
          rejectReason: dto.reason,
          rejectedBy: user.id,
          rejectedAt: new Date(),
          rejectStage: sheet.currentStage,
          updatedBy: user.id,
        },
        em,
      );
      await this.addHistory(item, ItemHistoryAction.REJECTED, sheet.currentStage, user.id, em, {
        reason: dto.reason,
      });
      await this.recomputeTotals(id, em);
      const completed = await this.maybeComplete(id, user, em);
      return { completed };
    });
    return { message: PAYMENT_SHEET_RESPONSES.ITEM_REJECTED, completed: res.completed };
  }

  /** Marks the sheet COMPLETED when every item is terminal (PAID/REJECTED) and none on HOLD/PENDING. */
  private async maybeComplete(id: string, user: ActingUser, em: EntityManager): Promise<boolean> {
    const items = await this.repo.findItems(
      { where: { paymentSheetId: id, deletedAt: IsNull() } },
      em,
    );
    if (!items.length) return false;
    const allTerminal = items.every(
      (i) =>
        i.itemStatus === PaymentSheetItemStatus.PAID ||
        i.itemStatus === PaymentSheetItemStatus.REJECTED,
    );
    if (!allTerminal) return false;
    const sheet = await this.repo.findSheet({ where: { id } }, em);
    if (sheet) {
      await this.addStageLog(sheet, StageAction.COMPLETE, null, user, null, em);
    }
    await this.repo.updateSheet(
      { id },
      { status: PaymentSheetStatus.COMPLETED, currentStage: null, updatedBy: user.id },
      em,
    );
    this.notifyInitiator(id, StageAction.COMPLETE);
    return true;
  }

  // ─────────────────────────── reconcile ───────────────────────────

  async reconcile(id: string) {
    const sheet = await this.repo.findSheet({ where: { id, deletedAt: IsNull() } });
    if (!sheet) throw new NotFoundException(PAYMENT_SHEET_ERRORS.NOT_FOUND);
    const items = await this.repo.findItems({
      where: { paymentSheetId: id, deletedAt: IsNull() },
      order: { createdAt: 'ASC' },
    });
    const lines = [];
    for (const item of items) {
      const livePending = await this.computeLivePending(item);
      const current = Number(item.currentAmount);
      lines.push({
        itemId: item.id,
        beneficiaryType: item.beneficiaryType,
        userId: item.userId,
        vendorId: item.vendorId,
        sourceType: item.sourceType,
        itemStatus: item.itemStatus,
        pendingSnapshot: Number(item.pendingSnapshot),
        currentAmount: current,
        livePending,
        difference: Number((livePending - Number(item.pendingSnapshot)).toFixed(2)),
        conflict: current > livePending + 0.01,
      });
    }
    return { sheetId: id, sheetNumber: sheet.sheetNumber, status: sheet.status, lines };
  }

  // ─────────────────────────── sync to latest pending (OM stage only) ───────────────────────────

  /**
   * Re-pull live pending and save it onto each line. Allowed ONLY while the sheet is with
   * the initiator (DRAFT/RETURNED at INITIATION) — nothing is approved yet there, so syncing
   * up or down is safe. Vendor lines refresh their book-payment allocations (dropping any
   * transferred elsewhere); lines whose live pending is now 0 are removed. All changes logged.
   * Downstream drift is still caught by the pay-time conflict guard.
   */
  async syncToLatest(id: string, user: ActingUser) {
    return await this.dataSource.transaction(async (em) => {
      const sheet = await this.loadEditableSheet(id, em);
      const flow = await this.getApprovalFlow(em);

      const atInitiation =
        [PaymentSheetStatus.DRAFT, PaymentSheetStatus.RETURNED].includes(
          sheet.status as PaymentSheetStatus,
        ) && sheet.currentStage === PaymentSheetStage.INITIATION;
      if (!atInitiation) {
        throw new BadRequestException(
          'Amounts can be synced to latest pending only while the sheet is with the initiator (DRAFT/RETURNED)',
        );
      }
      if (user.activeRole !== flow[0].role && user.activeRole !== SUPER_ADMIN) {
        throw new ForbiddenException(PAYMENT_SHEET_ERRORS.NOT_EDITABLE_STAGE);
      }

      const items = await this.repo.findItems(
        { where: { paymentSheetId: id, deletedAt: IsNull() } },
        em,
      );
      const updated: Array<{ itemId: string; previousAmount: number; newAmount: number }> = [];
      const removed: Array<{ itemId: string; reason: string }> = [];
      const skipped: Array<{ itemId: string; reason: string }> = [];

      for (const item of items) {
        const prev = Number(item.currentAmount);

        // Verified-by-a-later-stage lines are locked for the initiator — leave untouched.
        if (await this.isEditLocked(item.id, sheet.currentStage, flow, em)) {
          skipped.push({ itemId: item.id, reason: 'verified by a later stage (locked)' });
          continue;
        }

        if (item.beneficiaryType === BeneficiaryType.VENDOR) {
          const allocs = await this.repo.findAllocations(
            { where: { itemId: item.id, deletedAt: IsNull() } },
            em,
          );
          let newPending = 0;
          if (allocs.length) {
            const { query, params } = bookPaymentsTransferableQuery(
              allocs.map((a) => a.bookPaymentId),
            );
            const rows = await this.repo.raw(query, params, em);
            const byId = new Map<string, any>(rows.map((r: any) => [r.bookPaymentId, r]));
            for (const a of allocs) {
              const r = byId.get(a.bookPaymentId);
              const eligible = r && r.hasTransfer === false && r.approvalStatus === 'APPROVED';
              if (!eligible) {
                await this.repo.softDeleteAllocation({ id: a.id }, em);
                continue;
              }
              const t = Number(r.transferable);
              newPending += t;
              if (Math.abs(Number(a.allocatedAmount) - t) > 0.01) {
                await this.repo.updateAllocation(
                  { id: a.id },
                  { allocatedAmount: t, updatedBy: user.id },
                  em,
                );
              }
            }
          }
          if (newPending <= 0) {
            await this.removeLineOnSync(
              item,
              'No transferable book payments remaining (synced)',
              user,
              em,
            );
            removed.push({ itemId: item.id, reason: 'no transferable book payments' });
            continue;
          }
          if (Math.abs(newPending - prev) > 0.01) {
            await this.repo.updateItem(
              { id: item.id },
              {
                currentAmount: newPending,
                requestedAmount: newPending,
                pendingSnapshot: newPending,
                updatedBy: user.id,
              },
              em,
            );
            await this.addHistory(
              item,
              ItemHistoryAction.AMOUNT_EDIT,
              PaymentSheetStage.INITIATION,
              user.id,
              em,
              {
                previousAmount: prev,
                newAmount: newPending,
                reason: 'Synced to latest pending',
              },
            );
            updated.push({ itemId: item.id, previousAmount: prev, newAmount: newPending });
          } else {
            await this.repo.updateItem({ id: item.id }, { pendingSnapshot: newPending }, em);
          }
          continue;
        }

        // USER (expense / fuel)
        const live = await this.computeLivePending(item, em);
        if (live <= 0) {
          await this.removeLineOnSync(item, 'No pending remaining (synced)', user, em);
          removed.push({ itemId: item.id, reason: 'no pending remaining' });
          continue;
        }
        if (Math.abs(live - prev) > 0.01) {
          await this.repo.updateItem(
            { id: item.id },
            {
              currentAmount: live,
              requestedAmount: live,
              pendingSnapshot: live,
              updatedBy: user.id,
            },
            em,
          );
          await this.addHistory(
            item,
            ItemHistoryAction.AMOUNT_EDIT,
            PaymentSheetStage.INITIATION,
            user.id,
            em,
            {
              previousAmount: prev,
              newAmount: live,
              reason: 'Synced to latest pending',
            },
          );
          updated.push({ itemId: item.id, previousAmount: prev, newAmount: live });
        } else {
          await this.repo.updateItem({ id: item.id }, { pendingSnapshot: live }, em);
        }
      }

      await this.recomputeTotals(id, em);
      return {
        message: 'Amounts synced to latest pending',
        updatedCount: updated.length,
        removedCount: removed.length,
        skippedCount: skipped.length,
        updated,
        removed,
        skipped,
      };
    });
  }

  private async removeLineOnSync(
    item: PaymentSheetItemEntity,
    reason: string,
    user: ActingUser,
    em: EntityManager,
  ) {
    await this.addHistory(
      item,
      ItemHistoryAction.ITEM_REMOVED,
      PaymentSheetStage.INITIATION,
      user.id,
      em,
      {
        previousAmount: Number(item.currentAmount),
        reason,
      },
    );
    await this.repo.softDeleteItem({ id: item.id }, em);
  }

  // ─────────────────────────── PDF ───────────────────────────

  async getPdfUrl(id: string, filter?: { sourceType?: string; beneficiaryType?: string }) {
    const detail = await this.findOne(id);

    const sourceType = filter?.sourceType;
    const beneficiaryType = filter?.beneficiaryType;
    if (sourceType && !Object.values(PaymentSourceType).includes(sourceType as PaymentSourceType)) {
      throw new BadRequestException(`Invalid sourceType: ${sourceType}`);
    }
    if (
      beneficiaryType &&
      !Object.values(BeneficiaryType).includes(beneficiaryType as BeneficiaryType)
    ) {
      throw new BadRequestException(`Invalid beneficiaryType: ${beneficiaryType}`);
    }

    // No filter → cached full-sheet PDF.
    if (!sourceType && !beneficiaryType) {
      const key = await this.pdfService.ensurePdf(detail as any);
      return await this.pdfService.getDownloadUrl(key);
    }

    // Filtered → render only the matching lines into a distinct, non-cached key.
    let items = (detail as any).items as PaymentSheetItemEntity[];
    if (sourceType) items = items.filter((i) => i.sourceType === sourceType);
    if (beneficiaryType) items = items.filter((i) => i.beneficiaryType === beneficiaryType);
    if (!items.length) {
      throw new BadRequestException('No items on this sheet match the requested filter');
    }

    const parts = [beneficiaryType, sourceType].filter(Boolean) as string[];
    const filterLabel = parts.join(' / ');
    const keySuffix = parts
      .join('-')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
    const key = await this.pdfService.generateVariant(detail as any, items, keySuffix, filterLabel);
    return await this.pdfService.getDownloadUrl(key);
  }

  // ─────────────────────────── notifications (best-effort) ───────────────────────────

  private async emailsForRole(role: string): Promise<string[]> {
    try {
      const rows = await this.repo.raw(
        `
        SELECT DISTINCT u.email AS email
        FROM users u
        JOIN user_roles ur ON ur."userId" = u.id
        JOIN roles r ON r.id = ur."roleId"
        WHERE r.name = $1 AND u."deletedAt" IS NULL AND u.email IS NOT NULL
        `,
        [role],
      );
      return rows.map((r: any) => r.email).filter(Boolean);
    } catch (e) {
      this.logger.warn(`emailsForRole failed: ${e}`);
      return [];
    }
  }

  private notifyStage(sheetId: string, nextRole: string, action: StageAction) {
    setImmediate(async () => {
      try {
        const sheet = await this.repo.findSheet({ where: { id: sheetId } });
        const recipients = await this.emailsForRole(nextRole);
        if (!sheet || !recipients.length) return;
        await this.sendStageEmail(recipients, sheet, action, nextRole);
      } catch (e) {
        this.logger.warn(`notifyStage failed: ${e}`);
      }
    });
  }

  private notifyInitiator(sheetId: string, action: StageAction) {
    setImmediate(async () => {
      try {
        const sheet = await this.repo.findSheet({ where: { id: sheetId } });
        if (!sheet?.createdBy) return;
        const rows = await this.repo.raw(`SELECT email FROM users WHERE id = $1`, [
          sheet.createdBy,
        ]);
        const email = rows?.[0]?.email;
        if (!email) return;
        await this.sendStageEmail([email], sheet, action, 'INITIATOR');
      } catch (e) {
        this.logger.warn(`notifyInitiator failed: ${e}`);
      }
    });
  }

  private async sendStageEmail(
    recipients: string[],
    sheet: PaymentSheetEntity,
    action: StageAction,
    audience: string,
  ) {
    await this.emailService.sendMail({
      receiverEmails: recipients,
      subject: `Payment Sheet ${sheet.sheetNumber} — ${action}`,
      template: 'paymentSheetNotification',
      emailData: {
        sheetNumber: sheet.sheetNumber,
        title: sheet.title ?? sheet.sheetNumber,
        status: sheet.status,
        stage: sheet.currentStage ?? '—',
        action,
        audience,
        totalCurrentAmount: Number(sheet.totalCurrentAmount).toLocaleString('en-IN'),
      },
    });
  }
}
