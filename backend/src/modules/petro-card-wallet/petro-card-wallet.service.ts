import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import {
  DataSource,
  EntityManager,
  IsNull,
  ILike,
  Between,
  MoreThanOrEqual,
  LessThanOrEqual,
} from 'typeorm';
import { PetroCardWalletRepository } from './petro-card-wallet.repository';
import { PetroCardWalletRechargeEntity } from './entities/petro-card-wallet-recharge.entity';
import { CompanyBankAccountEntity } from 'src/modules/company-bank-accounts/entities/company-bank-account.entity';
import {
  CreateWalletRechargeDto,
  UpdateWalletRechargeDto,
  GetWalletRechargesDto,
  GetWalletTransactionsDto,
} from './dto';
import {
  PETRO_CARD_WALLET_LOCK_KEY,
  PETRO_CARD_WALLET_ERRORS,
  PETRO_CARD_WALLET_RESPONSES,
  WalletRechargeStatus,
} from './constants/petro-card-wallet.constants';
import {
  walletBalanceQuery,
  walletTransactionsQuery,
  outstandingRechargesQuery,
  RECHARGE_CLAIMED_BY_LIVE_SHEET,
} from './queries/petro-card-wallet.queries';
import { formatInr } from 'src/modules/common/financials/amount-format.helper';
import { formatUser } from 'src/modules/common/financials/user-format.helper';
import { DefaultPaginationValues } from 'src/utils/utility/constants/utility.constants';

export interface WalletBalance {
  balance: number;
  totalRecharged: number;
  totalConsumed: number;
  pendingConsumed: number;
  approvedConsumed: number;
  /** Raised and not yet paid, wherever it has got to — so not in `balance` yet. */
  pendingRecharge: number;
  /** The part of `pendingRecharge` still waiting to be picked onto a Payment Sheet. */
  outstandingRecharge: number;
}

@Injectable()
export class PetroCardWalletService {
  constructor(
    private readonly rechargeRepository: PetroCardWalletRepository,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Serialise everything that reads the balance in order to decide a write.
   *
   * The balance is derived, so there is no row to lock. Without this, two fuel entries of ₹600 can
   * both pass a check against a ₹1,000 balance and leave the wallet at −₹200. Transaction-scoped:
   * it releases on commit or rollback, and is held only for the few statements in between.
   */
  private async lockWallet(em: EntityManager): Promise<void> {
    await em.query('SELECT pg_advisory_xact_lock($1)', [PETRO_CARD_WALLET_LOCK_KEY]);
  }

  /**
   * The wallet balance, and the parts it is made of.
   *
   * Pass the `EntityManager` when reading inside a transaction that will then write — otherwise the
   * read happens outside it and the lock protects nothing.
   */
  async getBalance(em?: EntityManager): Promise<WalletBalance> {
    const [row] = await (em ?? this.dataSource).query(walletBalanceQuery);
    return {
      balance: Number(row?.balance ?? 0),
      totalRecharged: Number(row?.totalRecharged ?? 0),
      totalConsumed: Number(row?.totalConsumed ?? 0),
      pendingConsumed: Number(row?.pendingConsumed ?? 0),
      approvedConsumed: Number(row?.approvedConsumed ?? 0),
      pendingRecharge: Number(row?.pendingRecharge ?? 0),
      outstandingRecharge: Number(row?.outstandingRecharge ?? 0),
    };
  }

  /**
   * Refuse a petro-card fuel entry the wallet cannot cover.
   *
   * Called from inside the fuel expense's own transaction, so the lock taken here also covers the
   * insert that follows. Callers that are only *changing* an existing entry must make sure the old
   * row has already stopped consuming before calling — otherwise it is counted twice.
   */
  async assertSufficientBalance(amount: number, em: EntityManager): Promise<void> {
    await this.lockWallet(em);
    const { balance } = await this.getBalance(em);
    if (Number(amount) > balance) {
      throw new BadRequestException(
        PETRO_CARD_WALLET_ERRORS.INSUFFICIENT_BALANCE.replace(
          '{available}',
          formatInr(balance),
        ).replace('{required}', formatInr(Number(amount))),
      );
    }
  }

  private async assertBankAccountExists(id: string | undefined, em: EntityManager): Promise<void> {
    if (!id) return;
    const account = await em
      .getRepository(CompanyBankAccountEntity)
      .findOne({ where: { id, deletedAt: IsNull() } });
    if (!account) throw new NotFoundException(PETRO_CARD_WALLET_ERRORS.BANK_ACCOUNT_NOT_FOUND);
  }

  /**
   * What state is this recharge in, and is a live Payment Sheet line holding it?
   *
   * One round trip, because every guard below needs all three answers: the status, whether a
   * sheet still claims it, and which sheet that is so the refusal can name it.
   */
  private async loadRechargeState(id: string, em: EntityManager) {
    const [row] = await em.query(
      `
        SELECT r."id", r."amount", r."status",
               ${RECHARGE_CLAIMED_BY_LIVE_SHEET} AS "claimed",
               ps."sheetNumber" AS "sheetNumber"
          FROM petro_card_wallet_recharges r
          LEFT JOIN payment_sheet_items psi ON psi."id" = r."paymentSheetItemId"
          LEFT JOIN payment_sheets ps       ON ps."id"  = psi."paymentSheetId"
         WHERE r."id" = $1 AND r."deletedAt" IS NULL
      `,
      [id],
    );
    if (!row) throw new NotFoundException(PETRO_CARD_WALLET_ERRORS.RECHARGE_NOT_FOUND);
    return {
      amount: Number(row.amount),
      status: row.status as WalletRechargeStatus,
      claimed: Boolean(row.claimed),
      sheetNumber: (row.sheetNumber as string | null) ?? null,
    };
  }

  /**
   * A recharge may only be changed while it is still nothing but a request.
   *
   * Two different refusals on purpose: "already paid" is final and the user should stop, while
   * "it is on sheet PS-0012" tells them exactly where to go to undo it.
   */
  private assertOutstanding(state: {
    status: WalletRechargeStatus;
    claimed: boolean;
    sheetNumber: string | null;
  }): void {
    if (state.status === WalletRechargeStatus.PAID) {
      throw new BadRequestException(PETRO_CARD_WALLET_ERRORS.RECHARGE_FROM_PAYMENT_SHEET);
    }
    if (state.claimed) {
      throw new BadRequestException(
        PETRO_CARD_WALLET_ERRORS.RECHARGE_ON_A_SHEET.replace(
          '{sheet}',
          state.sheetNumber ?? 'a Payment Sheet',
        ),
      );
    }
  }

  /**
   * Claim an outstanding recharge for a Payment Sheet line being added.
   *
   * Called from inside the sheet own transaction. Taking the link here rather than at payment
   * is what stops one recharge being picked onto two sheets and paid twice; the unique index on
   * the column is the backstop if two sheets are built at the same moment.
   *
   * Returns the amount, which the line is then built from — the initiator does not type it, so a
   * line can never ask for more than was actually raised.
   */
  async claimForPaymentSheetItem(
    params: { rechargeId: string; paymentSheetItemId: string; updatedBy: string },
    em: EntityManager,
  ): Promise<number> {
    await this.lockWallet(em);
    const state = await this.loadRechargeState(params.rechargeId, em);
    if (state.status !== WalletRechargeStatus.PENDING || state.claimed) {
      throw new BadRequestException(PETRO_CARD_WALLET_ERRORS.RECHARGE_NOT_OUTSTANDING);
    }
    await this.rechargeRepository.update(
      { id: params.rechargeId },
      { paymentSheetItemId: params.paymentSheetItemId, updatedBy: params.updatedBy },
      em,
    );
    return state.amount;
  }

  /**
   * Mark the recharge behind a Payment Sheet line PAID — the only thing that moves money into
   * the wallet.
   *
   * Runs inside the sheet stamping transaction, so the credit and the PAID stamp commit together
   * and the wallet can never hold money for a line that did not finish paying. Idempotent: a
   * retried pay step finds the row already PAID and returns it.
   *
   * The payment details are written here rather than kept from when the recharge was raised,
   * because until it is paid nobody knows the UTR, the mode, or which account it actually went
   * from. The amount follows the line, so a figure trimmed at review is what lands in the wallet.
   */
  async markPaidForPaymentSheetItem(
    params: {
      paymentSheetItemId: string;
      amount: number;
      rechargeDate: Date;
      referenceNumber: string | null;
      paymentMode: string | null;
      paidFromAccountId: string | null;
      remarks: string | null;
      updatedBy: string;
    },
    em: EntityManager,
  ) {
    await this.lockWallet(em);

    const existing = await this.rechargeRepository.findOne(
      { where: { paymentSheetItemId: params.paymentSheetItemId, deletedAt: IsNull() } },
      em,
    );
    // No row means the line was built before this flow existed. Nothing to credit and nothing to
    // guess at, so the pay step is allowed to finish rather than stranding the sheet.
    if (!existing) return null;
    if (existing.status === WalletRechargeStatus.PAID) return existing;

    await this.rechargeRepository.update(
      { id: existing.id },
      {
        status: WalletRechargeStatus.PAID,
        amount: params.amount,
        rechargeDate: params.rechargeDate,
        referenceNumber: params.referenceNumber,
        paymentMode: params.paymentMode,
        paidFromAccountId: params.paidFromAccountId,
        remarks: params.remarks,
        updatedBy: params.updatedBy,
      },
      em,
    );
    return await this.rechargeRepository.findOne({ where: { id: existing.id } }, em);
  }
  /**
   * Raise a recharge. This does **not** credit the wallet.
   *
   * It records that the company intends to put money on the cards. The row lands PENDING, shows up
   * in the outstanding list, and the balance does not move until a Payment Sheet line for it is
   * paid. Until that happened this method credited on the spot, which is how a balance appeared
   * against a payment nobody had made.
   *
   * Payment details may be sent and are kept as what was intended; the pay step overwrites them
   * with the UTR, mode and account the money actually went out on.
   */
  async createRecharge(dto: CreateWalletRechargeDto, createdBy: string) {
    return await this.dataSource.transaction(async (em) => {
      // The balance does not move here, but the same lock is still taken: the response reports it,
      // and reporting a figure read outside the lock is how confusing screenshots start.
      await this.lockWallet(em);
      await this.assertBankAccountExists(dto.paidFromAccountId, em);

      const created = await this.rechargeRepository.create(
        {
          amount: dto.amount,
          rechargeDate: new Date(dto.rechargeDate),
          referenceNumber: dto.referenceNumber ?? null,
          paymentMode: dto.paymentMode ?? null,
          paidFromAccountId: dto.paidFromAccountId ?? null,
          remarks: dto.remarks ?? null,
          status: WalletRechargeStatus.PENDING,
          createdBy,
        },
        em,
      );

      const { balance, outstandingRecharge } = await this.getBalance(em);
      return {
        message: PETRO_CARD_WALLET_RESPONSES.RECHARGE_CREATED,
        id: created.id,
        status: WalletRechargeStatus.PENDING,
        balance,
        outstandingRecharge,
      };
    });
  }

  async updateRecharge(id: string, dto: UpdateWalletRechargeDto, updatedBy: string) {
    return await this.dataSource.transaction(async (em) => {
      await this.lockWallet(em);

      this.assertOutstanding(await this.loadRechargeState(id, em));

      await this.assertBankAccountExists(dto.paidFromAccountId, em);

      // Only what was sent is written: a correction usually touches one field, and spreading the
      // whole DTO would blank the rest.
      const patch: Partial<PetroCardWalletRechargeEntity> = { updatedBy };
      if (dto.amount !== undefined) patch.amount = dto.amount;
      if (dto.rechargeDate !== undefined) patch.rechargeDate = new Date(dto.rechargeDate);
      if (dto.referenceNumber !== undefined) patch.referenceNumber = dto.referenceNumber;
      if (dto.paymentMode !== undefined) patch.paymentMode = dto.paymentMode;
      if (dto.paidFromAccountId !== undefined) patch.paidFromAccountId = dto.paidFromAccountId;
      if (dto.remarks !== undefined) patch.remarks = dto.remarks;

      await this.rechargeRepository.update({ id }, patch, em);

      // The balance cannot move here — only PENDING rows can be edited and they are not in it —
      // but it is still returned so the screen that just saved has the current figures.
      const { balance, outstandingRecharge } = await this.getBalance(em);
      return {
        message: PETRO_CARD_WALLET_RESPONSES.RECHARGE_UPDATED,
        id,
        balance,
        outstandingRecharge,
      };
    });
  }

  async deleteRecharge(id: string, deletedBy: string) {
    return await this.dataSource.transaction(async (em) => {
      await this.lockWallet(em);

      this.assertOutstanding(await this.loadRechargeState(id, em));

      // Withdrawing a request, not reversing money: a PENDING row was never in the balance, so
      // there is nothing to put back.
      await this.rechargeRepository.update({ id }, { deletedBy, updatedBy: deletedBy }, em);
      await this.rechargeRepository.softDelete({ id }, em);

      const { balance, outstandingRecharge } = await this.getBalance(em);
      return {
        message: PETRO_CARD_WALLET_RESPONSES.RECHARGE_DELETED,
        id,
        balance,
        outstandingRecharge,
      };
    });
  }

  /**
   * What the wallet is still owed: raised, unpaid, and not already on a live Payment Sheet.
   *
   * The Payment Sheet's beneficiary picker reads this, which is the whole point — a wallet top-up
   * is now picked from here rather than typed as a free amount, so the line can never ask for more
   * than was actually raised.
   *
   * Its own list rather than a row in the per-employee pending-settlement API: a top-up has no
   * employee, no employee code and no bank details, so it cannot take that shape without breaking
   * it for every caller already reading those fields.
   */
  async getOutstanding(query: GetWalletRechargesDto) {
    const { page = DefaultPaginationValues.PAGE, pageSize = DefaultPaginationValues.PAGE_SIZE } =
      query;

    const rows = await this.dataSource.query(outstandingRechargesQuery, [
      pageSize,
      (page - 1) * pageSize,
    ]);

    return {
      records: rows.map((r: Record<string, unknown>) => ({
        id: r.id,
        amount: Number(r.amount),
        rechargeDate: r.rechargeDate,
        remarks: r.remarks,
        raisedBy: r.raisedBy,
        createdAt: r.createdAt,
      })),
      totalRecords: Number(rows[0]?.totalRecords ?? 0),
      totalOutstanding: Number(rows[0]?.totalOutstanding ?? 0),
    };
  }

  /** The recharge grid — recharges only, which is where the CRUD buttons live. */
  async getRecharges(query: GetWalletRechargesDto) {
    const {
      page = DefaultPaginationValues.PAGE,
      pageSize = DefaultPaginationValues.PAGE_SIZE,
      dateFrom,
      dateTo,
      search,
    } = query;

    const base: Record<string, unknown> = { deletedAt: IsNull() };
    if (dateFrom && dateTo) base.rechargeDate = Between(new Date(dateFrom), new Date(dateTo));
    else if (dateFrom) base.rechargeDate = MoreThanOrEqual(new Date(dateFrom));
    else if (dateTo) base.rechargeDate = LessThanOrEqual(new Date(dateTo));

    // Search spans two columns, so it needs two where-clauses OR'd — an array of conditions.
    const where = search
      ? [
          { ...base, referenceNumber: ILike(`%${search}%`) },
          { ...base, remarks: ILike(`%${search}%`) },
        ]
      : base;

    const [records, totalRecords] = await this.rechargeRepository.findAndCount({
      where: where as never,
      relations: ['paidFromAccount', 'createdByUser', 'updatedByUser'],
      order: { rechargeDate: 'DESC', createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      records: records.map((r) => ({
        id: r.id,
        amount: Number(r.amount),
        status: r.status,
        rechargeDate: r.rechargeDate,
        referenceNumber: r.referenceNumber,
        paymentMode: r.paymentMode,
        paidFromAccountId: r.paidFromAccountId,
        paidFromAccount: r.paidFromAccount
          ? {
              id: r.paidFromAccount.id,
              accountName: r.paidFromAccount.accountName,
              accountHolderName: r.paidFromAccount.accountHolderName,
              bankName: r.paidFromAccount.bankName,
              accountNumber: r.paidFromAccount.accountNumber,
              ifscCode: r.paidFromAccount.ifscCode,
              branchName: r.paidFromAccount.branchName ?? null,
            }
          : null,
        remarks: r.remarks,
        createdAt: r.createdAt,
        createdByUser: formatUser(r.createdByUser),
        updatedByUser: formatUser(r.updatedByUser),
      })),
      totalRecords,
    };
  }

  /**
   * The recharge/transaction summary: recharges and fuel deductions in one list.
   *
   * Both sides are returned because a list of recharges alone cannot explain the balance. Only
   * recharge rows come back `editable: true` — fuel rows are managed from the fuel screen, which is
   * also why there is no manual debit API.
   *
   * No running "balance after" column: this list is filterable and paginated, so a running total
   * would be computed over whatever subset was asked for and would not match the real balance at
   * that point in time. The header figures from `/balance` are the honest answer.
   */
  async getTransactions(query: GetWalletTransactionsDto) {
    const {
      page = DefaultPaginationValues.PAGE,
      pageSize = DefaultPaginationValues.PAGE_SIZE,
      type,
      dateFrom,
      dateTo,
    } = query;

    const rows = await this.dataSource.query(walletTransactionsQuery, [
      type ?? null,
      dateFrom ? new Date(dateFrom) : null,
      dateTo ? new Date(dateTo) : null,
      pageSize,
      (page - 1) * pageSize,
    ]);

    return {
      records: rows.map((r: Record<string, unknown>) => ({
        type: r.type,
        id: r.id,
        date: r.date,
        amount: Number(r.amount),
        editable: r.editable,
        meta:
          r.type === 'RECHARGE'
            ? {
                status: r.rechargeStatus,
                referenceNumber: r.referenceNumber,
                paymentMode: r.paymentMode,
                paidFromAccount: r.paidFromAccount,
                remarks: r.remarks,
                recordedBy: r.recordedBy,
              }
            : {
                cardNumber: r.cardNumber,
                vehicleNumber: r.vehicleNumber,
                employeeName: r.employeeName,
                approvalStatus: r.approvalStatus,
                remarks: r.remarks,
              },
      })),
      totalRecords: Number(rows[0]?.totalRecords ?? 0),
    };
  }
}
