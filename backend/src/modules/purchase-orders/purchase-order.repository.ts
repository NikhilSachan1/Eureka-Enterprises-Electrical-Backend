import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  EntityManager,
  FindOneOptions,
  FindManyOptions,
  FindOptionsWhere,
} from 'typeorm';
import { PurchaseOrderEntity } from './entities/purchase-order.entity';

@Injectable()
export class PurchaseOrderRepository {
  constructor(
    @InjectRepository(PurchaseOrderEntity)
    private readonly repository: Repository<PurchaseOrderEntity>,
  ) {}

  private repo(em?: EntityManager) {
    return em ? em.getRepository(PurchaseOrderEntity) : this.repository;
  }

  async create(
    data: Partial<PurchaseOrderEntity>,
    em?: EntityManager,
  ): Promise<PurchaseOrderEntity> {
    try {
      const repo = this.repo(em);
      const row = repo.create(data);
      return await repo.save(row);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(
    options: FindOneOptions<PurchaseOrderEntity>,
    em?: EntityManager,
  ): Promise<PurchaseOrderEntity | null> {
    try {
      return await this.repo(em).findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(
    options: FindManyOptions<PurchaseOrderEntity>,
    em?: EntityManager,
  ): Promise<PurchaseOrderEntity[]> {
    try {
      return await this.repo(em).find(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async count(
    options: FindManyOptions<PurchaseOrderEntity>,
    em?: EntityManager,
  ): Promise<number> {
    try {
      return await this.repo(em).count(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    where: FindOptionsWhere<PurchaseOrderEntity>,
    data: Partial<PurchaseOrderEntity>,
    em?: EntityManager,
  ): Promise<void> {
    try {
      await this.repo(em).update(where, data);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async softDelete(
    where: FindOptionsWhere<PurchaseOrderEntity>,
    em?: EntityManager,
  ): Promise<void> {
    try {
      await this.repo(em).softDelete(where);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async restore(
    where: FindOptionsWhere<PurchaseOrderEntity>,
    em?: EntityManager,
  ): Promise<void> {
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
   * Lock a PO row inside a transaction so that concurrent invoice / book-payment
   * approvals serialize correctly when reading the rollup columns. (§7.3)
   */
  async findOneForUpdate(id: string, em: EntityManager): Promise<PurchaseOrderEntity | null> {
    return await em
      .getRepository(PurchaseOrderEntity)
      .createQueryBuilder('po')
      .setLock('pessimistic_write')
      .where('po.id = :id', { id })
      .andWhere('po."deletedAt" IS NULL')
      .getOne();
  }

  /**
   * Atomically increment / decrement rollup columns inside a transaction.
   * Pass negative numbers to decrement.
   */
  async adjustRollups(
    id: string,
    delta: {
      invoicedTotal?: number;
      bookedTotal?: number;
      paidTotal?: number;
      lastInvoiceAt?: Date;
      lastPaymentAt?: Date;
    },
    em: EntityManager,
  ): Promise<void> {
    const setClauses: string[] = [];
    const params: any[] = [];

    if (delta.invoicedTotal !== undefined) {
      params.push(delta.invoicedTotal);
      setClauses.push(`"invoicedTotal" = "invoicedTotal" + $${params.length}`);
    }
    if (delta.bookedTotal !== undefined) {
      params.push(delta.bookedTotal);
      setClauses.push(`"bookedTotal" = "bookedTotal" + $${params.length}`);
    }
    if (delta.paidTotal !== undefined) {
      params.push(delta.paidTotal);
      setClauses.push(`"paidTotal" = "paidTotal" + $${params.length}`);
    }
    if (delta.lastInvoiceAt) {
      params.push(delta.lastInvoiceAt);
      setClauses.push(`"lastInvoiceAt" = $${params.length}`);
    }
    if (delta.lastPaymentAt) {
      params.push(delta.lastPaymentAt);
      setClauses.push(`"lastPaymentAt" = $${params.length}`);
    }

    if (setClauses.length === 0) return;

    params.push(id);
    await em.query(
      `UPDATE purchase_orders SET ${setClauses.join(', ')} WHERE id = $${params.length}`,
      params,
    );
  }
}
