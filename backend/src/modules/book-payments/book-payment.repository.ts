import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  EntityManager,
  FindOneOptions,
  FindManyOptions,
  FindOptionsWhere,
} from 'typeorm';
import { BookPaymentEntity } from './entities/book-payment.entity';

@Injectable()
export class BookPaymentRepository {
  constructor(
    @InjectRepository(BookPaymentEntity)
    private readonly repository: Repository<BookPaymentEntity>,
  ) {}

  private repo(em?: EntityManager) {
    return em ? em.getRepository(BookPaymentEntity) : this.repository;
  }

  async create(data: Partial<BookPaymentEntity>, em?: EntityManager): Promise<BookPaymentEntity> {
    try {
      const repo = this.repo(em);
      const row = repo.create(data);
      return await repo.save(row);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(
    options: FindOneOptions<BookPaymentEntity>,
    em?: EntityManager,
  ): Promise<BookPaymentEntity | null> {
    try {
      return await this.repo(em).findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(
    options: FindManyOptions<BookPaymentEntity>,
    em?: EntityManager,
  ): Promise<BookPaymentEntity[]> {
    try {
      return await this.repo(em).find(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async count(options: FindManyOptions<BookPaymentEntity>, em?: EntityManager): Promise<number> {
    try {
      return await this.repo(em).count(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    where: FindOptionsWhere<BookPaymentEntity>,
    data: Partial<BookPaymentEntity>,
    em?: EntityManager,
  ): Promise<void> {
    try {
      await this.repo(em).update(where, data);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async softDelete(where: FindOptionsWhere<BookPaymentEntity>, em?: EntityManager): Promise<void> {
    try {
      await this.repo(em).softDelete(where);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async restore(where: FindOptionsWhere<BookPaymentEntity>, em?: EntityManager): Promise<void> {
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
   * Lock a book payment row inside a transaction for bank transfer validation.
   */
  async findOneForUpdate(id: string, em: EntityManager): Promise<BookPaymentEntity | null> {
    return await em
      .getRepository(BookPaymentEntity)
      .createQueryBuilder('bp')
      .setLock('pessimistic_write')
      .where('bp.id = :id', { id })
      .andWhere('bp."deletedAt" IS NULL')
      .getOne();
  }

  /**
   * Sum of paymentTotalAmount for a given invoice (PURCHASE side).
   * TDS is now at invoice level — paymentTotalAmount = taxableAmount - pro-rata TDS.
   * Ceiling check: Σ(paymentTotalAmount) ≤ invoice.taxableAmount − invoice.tdsAmount.
   */
  async sumByInvoice(invoiceId: string, em?: EntityManager): Promise<number> {
    const result = await this.repo(em)
      .createQueryBuilder('bp')
      .select('COALESCE(SUM(bp."paymentTotalAmount"), 0)', 'total')
      .where('bp."invoiceId" = :invoiceId', { invoiceId })
      .andWhere('bp."deletedAt" IS NULL')
      .getRawOne();
    return Number(result?.total ?? 0);
  }
}
