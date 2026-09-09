import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { AdvancePaymentEntity } from './entities/advance-payment.entity';

@Injectable()
export class AdvancePaymentRepository {
  constructor(
    @InjectRepository(AdvancePaymentEntity)
    private readonly repository: Repository<AdvancePaymentEntity>,
  ) {}

  private repo(em?: EntityManager): Repository<AdvancePaymentEntity> {
    return em ? em.getRepository(AdvancePaymentEntity) : this.repository;
  }

  async create(data: Partial<AdvancePaymentEntity>, em?: EntityManager) {
    try {
      return await this.repo(em).save(this.repo(em).create(data));
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(options: FindOneOptions<AdvancePaymentEntity>, em?: EntityManager) {
    return await this.repo(em).findOne(options);
  }

  async findAll(options: FindManyOptions<AdvancePaymentEntity>, em?: EntityManager) {
    return await this.repo(em).find(options);
  }

  async count(options: FindManyOptions<AdvancePaymentEntity>, em?: EntityManager) {
    return await this.repo(em).count(options);
  }

  async update(
    where: FindOptionsWhere<AdvancePaymentEntity>,
    data: Partial<AdvancePaymentEntity>,
    em?: EntityManager,
  ) {
    await this.repo(em).update(where, data);
  }

  async softDelete(where: FindOptionsWhere<AdvancePaymentEntity>, em?: EntityManager) {
    await this.repo(em).softDelete(where);
  }

  /**
   * Row-locked read, used before any decision that depends on `settledAmount` or the PO headroom.
   * Two concurrent approvals of different advances on the same PO would otherwise each read a
   * stale total and both pass a check that only one should.
   */
  async findOneForUpdate(id: string, em: EntityManager): Promise<AdvancePaymentEntity | null> {
    return await em
      .getRepository(AdvancePaymentEntity)
      .createQueryBuilder('ap')
      .setLock('pessimistic_write')
      .where('ap.id = :id', { id })
      .andWhere('ap."deletedAt" IS NULL')
      .getOne();
  }

  /**
   * Total of APPROVED advances on a PO. This is the figure the PO-headroom check consumes, so it
   * deliberately ignores PENDING and REJECTED rows — a pending advance has not committed anything.
   */
  async sumApprovedByPo(poId: string, em?: EntityManager, excludeId?: string): Promise<number> {
    const qb = this.repo(em)
      .createQueryBuilder('ap')
      .select('COALESCE(SUM(ap.amount), 0)', 'total')
      .where('ap."poId" = :poId', { poId })
      .andWhere('ap."deletedAt" IS NULL')
      .andWhere(`ap."approvalStatus" = 'APPROVED'`);

    if (excludeId) {
      qb.andWhere('ap.id != :excludeId', { excludeId });
    }

    const row = await qb.getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  /** Advances on a PO with balance left, oldest first — the FIFO order settlement consumes in. */
  async findSettlableByPo(poId: string, em: EntityManager): Promise<AdvancePaymentEntity[]> {
    return await em
      .getRepository(AdvancePaymentEntity)
      .createQueryBuilder('ap')
      .setLock('pessimistic_write')
      .where('ap."poId" = :poId', { poId })
      .andWhere('ap."deletedAt" IS NULL')
      .andWhere(`ap."approvalStatus" = 'APPROVED'`)
      .andWhere('ap.amount > ap."settledAmount"')
      .orderBy('ap."advanceDate"', 'ASC')
      .addOrderBy('ap."createdAt"', 'ASC')
      .getMany();
  }
}
