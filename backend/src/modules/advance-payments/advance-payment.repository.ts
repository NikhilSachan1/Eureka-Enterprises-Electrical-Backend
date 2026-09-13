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
import { AdvanceSettlementEntity } from './entities/advance-settlement.entity';

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

  /**
   * Records that `amount` of `advancePaymentId` was consumed by `invoiceId`, and moves the
   * advance's own running total in the same step so the two can never disagree.
   *
   * `settledAmount` is incremented with a SQL expression rather than a read-modify-write: the
   * caller already holds a row lock from findSettlableByPo, but expressing it this way means a
   * stale in-memory copy cannot overwrite a concurrent change either.
   */
  async recordSettlement(
    params: { advancePaymentId: string; invoiceId: string; amount: number; createdBy: string },
    em: EntityManager,
  ): Promise<void> {
    const { advancePaymentId, invoiceId, amount, createdBy } = params;

    await em.getRepository(AdvanceSettlementEntity).save(
      em.getRepository(AdvanceSettlementEntity).create({
        advancePaymentId,
        invoiceId,
        amount,
        createdBy,
      }),
    );

    await em
      .getRepository(AdvancePaymentEntity)
      .update({ id: advancePaymentId }, { settledAmount: () => `"settledAmount" + ${amount}` });
  }

  /**
   * Undoes every settlement an invoice caused, restoring each advance's balance.
   *
   * Returns how much was given back, so the caller can log or assert on it. The advances are
   * row-locked first: an unlock and a concurrent approval on the same PO would otherwise race on
   * `settledAmount`.
   */
  async reverseSettlementsForInvoice(invoiceId: string, em: EntityManager): Promise<number> {
    const rows = await em.getRepository(AdvanceSettlementEntity).find({ where: { invoiceId } });

    if (rows.length === 0) {
      return 0;
    }

    await em
      .getRepository(AdvancePaymentEntity)
      .createQueryBuilder('ap')
      .setLock('pessimistic_write')
      .where('ap.id IN (:...ids)', { ids: rows.map((r) => r.advancePaymentId) })
      .getMany();

    for (const row of rows) {
      await em
        .getRepository(AdvancePaymentEntity)
        .update(
          { id: row.advancePaymentId },
          { settledAmount: () => `GREATEST("settledAmount" - ${Number(row.amount)}, 0)` },
        );
    }

    await em.getRepository(AdvanceSettlementEntity).delete({ invoiceId });

    return rows.reduce((sum, r) => sum + Number(r.amount), 0);
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
