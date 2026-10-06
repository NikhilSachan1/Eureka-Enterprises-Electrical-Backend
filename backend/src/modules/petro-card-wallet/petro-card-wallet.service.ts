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
} from './constants/petro-card-wallet.constants';
import { walletBalanceQuery, walletTransactionsQuery } from './queries/petro-card-wallet.queries';
import { formatInr } from 'src/modules/common/financials/amount-format.helper';
import { formatUser } from 'src/modules/common/financials/user-format.helper';
import { DefaultPaginationValues } from 'src/utils/utility/constants/utility.constants';

export interface WalletBalance {
  balance: number;
  totalRecharged: number;
  totalConsumed: number;
  pendingConsumed: number;
  approvedConsumed: number;
  /** Raised on a payment sheet, not yet paid — so not in `balance` yet. */
  pendingRecharge: number;
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
   * Credit the wallet for a Payment Sheet line that has just been paid.
   *
   * Called from inside the payment sheet's own stamping transaction, so the credit and the PAID
   * stamp commit together — the wallet can never hold money for a line that did not finish paying.
   *
   * The row carries `paymentSheetItemId`, which makes it read-only to the recharge CRUD: a paid
   * line cannot be reverted, and deleting the recharge it produced would be a way round that.
   */
  async creditFromPaymentSheetItem(
    params: {
      paymentSheetItemId: string;
      amount: number;
      rechargeDate: Date;
      referenceNumber: string | null;
      paymentMode: string | null;
      paidFromAccountId: string | null;
      remarks: string | null;
      createdBy: string;
    },
    em: EntityManager,
  ) {
    await this.lockWallet(em);

    // Idempotent: a retried pay step must not credit twice. The unique index backs this up, but
    // returning the existing row keeps the retry a success rather than a constraint error.
    const existing = await this.rechargeRepository.findOne(
      { where: { paymentSheetItemId: params.paymentSheetItemId, deletedAt: IsNull() } },
      em,
    );
    if (existing) return existing;

    return await this.rechargeRepository.create(
      {
        amount: params.amount,
        rechargeDate: params.rechargeDate,
        referenceNumber: params.referenceNumber,
        paymentMode: params.paymentMode,
        paidFromAccountId: params.paidFromAccountId,
        remarks: params.remarks,
        paymentSheetItemId: params.paymentSheetItemId,
        createdBy: params.createdBy,
      },
      em,
    );
  }

  /** A recharge that came from a paid payment sheet line is a record of a payment, not an entry. */
  private assertManualRecharge(recharge: PetroCardWalletRechargeEntity): void {
    if (recharge.paymentSheetItemId) {
      throw new BadRequestException(PETRO_CARD_WALLET_ERRORS.RECHARGE_FROM_PAYMENT_SHEET);
    }
  }

  async createRecharge(dto: CreateWalletRechargeDto, createdBy: string) {
    return await this.dataSource.transaction(async (em) => {
      // A recharge changes the balance, so it takes the same lock a balance check does — otherwise
      // it could land between another transaction's read and its write.
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
          createdBy,
        },
        em,
      );

      const { balance } = await this.getBalance(em);
      return { message: PETRO_CARD_WALLET_RESPONSES.RECHARGE_CREATED, id: created.id, balance };
    });
  }

  async updateRecharge(id: string, dto: UpdateWalletRechargeDto, updatedBy: string) {
    return await this.dataSource.transaction(async (em) => {
      await this.lockWallet(em);

      const existing = await this.rechargeRepository.findOne(
        { where: { id, deletedAt: IsNull() } },
        em,
      );
      if (!existing) throw new NotFoundException(PETRO_CARD_WALLET_ERRORS.RECHARGE_NOT_FOUND);
      this.assertManualRecharge(existing);

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

      // Reducing an amount can drive the balance negative, and that is allowed on purpose: the
      // money may genuinely have been spent already. The consequence is that new petro-card fuel
      // entries are refused until the wallet is topped up, which is the signal we want.
      const { balance } = await this.getBalance(em);
      return { message: PETRO_CARD_WALLET_RESPONSES.RECHARGE_UPDATED, id, balance };
    });
  }

  async deleteRecharge(id: string, deletedBy: string) {
    return await this.dataSource.transaction(async (em) => {
      await this.lockWallet(em);

      const existing = await this.rechargeRepository.findOne(
        { where: { id, deletedAt: IsNull() } },
        em,
      );
      if (!existing) throw new NotFoundException(PETRO_CARD_WALLET_ERRORS.RECHARGE_NOT_FOUND);

      this.assertManualRecharge(existing);
      // No reversal step: the row leaves the SUM, so the balance moves by itself.
      await this.rechargeRepository.update({ id }, { deletedBy, updatedBy: deletedBy }, em);
      await this.rechargeRepository.softDelete({ id }, em);

      const { balance } = await this.getBalance(em);
      return { message: PETRO_CARD_WALLET_RESPONSES.RECHARGE_DELETED, id, balance };
    });
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
