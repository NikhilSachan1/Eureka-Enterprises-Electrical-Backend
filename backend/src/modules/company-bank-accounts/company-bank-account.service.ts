import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, IsNull, Like } from 'typeorm';
import { CompanyBankAccountRepository } from './company-bank-account.repository';
import { CompanyBankAccountEntity } from './entities/company-bank-account.entity';
import {
  CreateCompanyBankAccountDto,
  UpdateCompanyBankAccountDto,
  QueryCompanyBankAccountDto,
} from './dto';
import {
  COMPANY_BANK_ACCOUNT_ERRORS,
  COMPANY_BANK_ACCOUNT_RESPONSES,
} from './constants/company-bank-account.constants';

/** Tables that may reference a company bank account — checked before a hard delete. */
const REFERENCING_TABLES = [
  { table: 'bank_transfers', column: 'paidFromAccountId' },
  { table: 'expenses', column: 'paidFromAccountId' },
  { table: 'fuel_expenses', column: 'paidFromAccountId' },
  { table: 'payment_sheet_items', column: 'paidFromAccountId' },
];

@Injectable()
export class CompanyBankAccountService {
  constructor(
    private readonly repository: CompanyBankAccountRepository,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateCompanyBankAccountDto, createdBy: string) {
    return await this.dataSource.transaction(async (em) => {
      if (dto.isDefault) {
        await this.repository.update({ isDefault: true }, { isDefault: false }, em);
      }
      const created = await this.repository.create({ ...dto, createdBy }, em);
      return { message: COMPANY_BANK_ACCOUNT_RESPONSES.CREATED, id: created.id };
    });
  }

  async findAll(query: QueryCompanyBankAccountDto) {
    const { isActive, search, page = 1, pageSize } = query;
    const base: any = { deletedAt: IsNull() };
    if (isActive !== undefined) base.isActive = isActive;

    // Search across accountName / bankName / accountNumber (OR'd via multiple where clauses).
    const where = search
      ? [
          { ...base, accountName: Like(`%${search}%`) },
          { ...base, bankName: Like(`%${search}%`) },
          { ...base, accountNumber: Like(`%${search}%`) },
        ]
      : base;

    const options: any = { where, order: { isDefault: 'DESC', accountName: 'ASC' } };
    if (pageSize !== undefined) {
      options.skip = (page - 1) * pageSize;
      options.take = pageSize;
    }

    const [records, totalRecords] = await Promise.all([
      this.repository.findAll(options),
      this.repository.count({ where }),
    ]);
    return { records, totalRecords };
  }

  async findById(id: string): Promise<CompanyBankAccountEntity> {
    const account = await this.repository.findOne({ where: { id, deletedAt: IsNull() } });
    if (!account) throw new NotFoundException(COMPANY_BANK_ACCOUNT_ERRORS.NOT_FOUND);
    return account;
  }

  /** Used by consumer modules (bank-transfers, expense-tracker, fuel-expense) to resolve + snapshot. */
  async findActiveOrFail(id: string): Promise<CompanyBankAccountEntity> {
    const account = await this.repository.findOne({ where: { id, deletedAt: IsNull() } });
    if (!account) throw new NotFoundException(COMPANY_BANK_ACCOUNT_ERRORS.NOT_FOUND);
    if (!account.isActive) throw new BadRequestException(COMPANY_BANK_ACCOUNT_ERRORS.NOT_ACTIVE);
    return account;
  }

  async update(id: string, dto: UpdateCompanyBankAccountDto, updatedBy: string) {
    return await this.dataSource.transaction(async (em) => {
      await this.findById(id);
      if (dto.isDefault) {
        await this.repository.update({ isDefault: true }, { isDefault: false }, em);
      }
      await this.repository.update({ id }, { ...dto, updatedBy }, em);
      return { message: COMPANY_BANK_ACCOUNT_RESPONSES.UPDATED };
    });
  }

  async setDefault(id: string, updatedBy: string) {
    return await this.dataSource.transaction(async (em) => {
      await this.findById(id);
      await this.repository.update({ isDefault: true }, { isDefault: false }, em);
      await this.repository.update({ id }, { isDefault: true, updatedBy }, em);
      return { message: COMPANY_BANK_ACCOUNT_RESPONSES.SET_DEFAULT };
    });
  }

  async remove(id: string, deletedBy: string) {
    await this.findById(id);

    for (const { table, column } of REFERENCING_TABLES) {
      const rows = await this.repository.raw(
        `SELECT 1 FROM "${table}" WHERE "${column}" = $1 AND "deletedAt" IS NULL LIMIT 1`,
        [id],
      );
      if (rows.length > 0) {
        throw new BadRequestException(COMPANY_BANK_ACCOUNT_ERRORS.IN_USE);
      }
    }

    await this.repository.update({ id }, { deletedBy });
    await this.repository.softDelete({ id });
    return { message: COMPANY_BANK_ACCOUNT_RESPONSES.DELETED };
  }
}
