import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  EntityManager,
  FindOneOptions,
  FindManyOptions,
  FindOptionsWhere,
} from 'typeorm';
import { PaymentAdviceEntity } from './entities/payment-advice.entity';
import { PaymentAdviceSequenceEntity } from './entities/payment-advice-sequence.entity';
import { PaymentAdviceEmailLogEntity } from './entities/payment-advice-email-log.entity';
import { PAYMENT_ADVICE_REFERENCE_PREFIX } from './constants/payment-advice.constants';

@Injectable()
export class PaymentAdviceRepository {
  constructor(
    @InjectRepository(PaymentAdviceEntity)
    private readonly repository: Repository<PaymentAdviceEntity>,
    @InjectRepository(PaymentAdviceSequenceEntity)
    private readonly sequenceRepository: Repository<PaymentAdviceSequenceEntity>,
    @InjectRepository(PaymentAdviceEmailLogEntity)
    private readonly emailLogRepository: Repository<PaymentAdviceEmailLogEntity>,
  ) {}

  private repo(em?: EntityManager) {
    return em ? em.getRepository(PaymentAdviceEntity) : this.repository;
  }

  async create(
    data: Partial<PaymentAdviceEntity>,
    em?: EntityManager,
  ): Promise<PaymentAdviceEntity> {
    try {
      const repo = this.repo(em);
      const row = repo.create(data);
      return await repo.save(row);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(
    options: FindOneOptions<PaymentAdviceEntity>,
    em?: EntityManager,
  ): Promise<PaymentAdviceEntity | null> {
    try {
      return await this.repo(em).findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(
    options: FindManyOptions<PaymentAdviceEntity>,
    em?: EntityManager,
  ): Promise<PaymentAdviceEntity[]> {
    try {
      return await this.repo(em).find(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async count(
    options: FindManyOptions<PaymentAdviceEntity>,
    em?: EntityManager,
  ): Promise<number> {
    try {
      return await this.repo(em).count(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    where: FindOptionsWhere<PaymentAdviceEntity>,
    data: Partial<PaymentAdviceEntity>,
    em?: EntityManager,
  ): Promise<void> {
    try {
      await this.repo(em).update(where, data);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async softDelete(
    where: FindOptionsWhere<PaymentAdviceEntity>,
    em?: EntityManager,
  ): Promise<void> {
    try {
      await this.repo(em).softDelete(where);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  /**
   * Allocate the next sequence number for a financial year using advisory lock.
   * Per §3.4 hardening #4, this uses pg_advisory_xact_lock to avoid row contention.
   */
  async allocateSequenceNumber(
    financialYear: string,
    em: EntityManager,
  ): Promise<{ sequenceNumber: number; referenceNumber: string }> {
    // Acquire advisory lock for this FY
    await em.query(
      `SELECT pg_advisory_xact_lock(hashtext($1))`,
      [`payment_advice_seq_${financialYear}`],
    );

    // Upsert sequence row and get next value
    const result = await em.query(
      `
        INSERT INTO payment_advice_sequences ("financialYear", "lastSeq")
        VALUES ($1, 1)
        ON CONFLICT ("financialYear")
        DO UPDATE SET "lastSeq" = payment_advice_sequences."lastSeq" + 1
        RETURNING "lastSeq"
      `,
      [financialYear],
    );

    const sequenceNumber = result[0].lastSeq;
    const referenceNumber = `${PAYMENT_ADVICE_REFERENCE_PREFIX}/${financialYear}/${String(sequenceNumber).padStart(3, '0')}`;

    return { sequenceNumber, referenceNumber };
  }

  async createEmailLog(
    data: Partial<PaymentAdviceEmailLogEntity>,
    em?: EntityManager,
  ): Promise<PaymentAdviceEmailLogEntity> {
    try {
      const repo = em
        ? em.getRepository(PaymentAdviceEmailLogEntity)
        : this.emailLogRepository;
      const row = repo.create(data);
      return await repo.save(row);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
