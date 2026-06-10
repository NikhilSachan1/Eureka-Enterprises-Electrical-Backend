import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  EntityManager,
  FindOneOptions,
  FindManyOptions,
  FindOptionsWhere,
} from 'typeorm';
import { BankTransferEntity } from './entities/bank-transfer.entity';

@Injectable()
export class BankTransferRepository {
  constructor(
    @InjectRepository(BankTransferEntity)
    private readonly repository: Repository<BankTransferEntity>,
  ) {}

  private repo(em?: EntityManager) {
    return em ? em.getRepository(BankTransferEntity) : this.repository;
  }

  async create(data: Partial<BankTransferEntity>, em?: EntityManager): Promise<BankTransferEntity> {
    try {
      const repo = this.repo(em);
      const row = repo.create(data);
      return await repo.save(row);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(
    options: FindOneOptions<BankTransferEntity>,
    em?: EntityManager,
  ): Promise<BankTransferEntity | null> {
    try {
      return await this.repo(em).findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(
    options: FindManyOptions<BankTransferEntity>,
    em?: EntityManager,
  ): Promise<BankTransferEntity[]> {
    try {
      return await this.repo(em).find(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async count(options: FindManyOptions<BankTransferEntity>, em?: EntityManager): Promise<number> {
    try {
      return await this.repo(em).count(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    where: FindOptionsWhere<BankTransferEntity>,
    data: Partial<BankTransferEntity>,
    em?: EntityManager,
  ): Promise<void> {
    try {
      await this.repo(em).update(where, data);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async softDelete(where: FindOptionsWhere<BankTransferEntity>, em?: EntityManager): Promise<void> {
    try {
      await this.repo(em).softDelete(where);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async restore(where: FindOptionsWhere<BankTransferEntity>, em?: EntityManager): Promise<void> {
    try {
      await this.repo(em).restore(where);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async executeRawQuery(query: string, params: any[] = [], em?: EntityManager): Promise<any> {
    try {
      return await this.repo(em).query(query, params);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  /**
   * Sum of transferAmount for a given invoice (SALE side).
   * TDS is now at invoice level — ceiling check: Σ(transferAmount) ≤ invoice.taxableAmount − invoice.tdsAmount.
   */
  async sumByInvoice(invoiceId: string, em?: EntityManager): Promise<number> {
    const result = await this.repo(em)
      .createQueryBuilder('bt')
      .select('COALESCE(SUM(bt."transferAmount"), 0)', 'total')
      .where('bt."invoiceId" = :invoiceId', { invoiceId })
      .andWhere('bt."deletedAt" IS NULL')
      .getRawOne();
    return Number(result?.total ?? 0);
  }

  /**
   * Check if a book payment already has a bank transfer (1:1).
   */
  async existsByBookPaymentId(bookPaymentId: string, em?: EntityManager): Promise<boolean> {
    const count = await this.repo(em).count({
      where: { bookPaymentId, deletedAt: null as any },
    });
    return count > 0;
  }
}
