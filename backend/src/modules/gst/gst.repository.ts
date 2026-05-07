import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  EntityManager,
  FindOneOptions,
  FindManyOptions,
  FindOptionsWhere,
} from 'typeorm';
import { GstRegisterEntryEntity } from './entities/gst-register-entry.entity';
import { GstPaymentEntity } from './entities/gst-payment.entity';
import { GstPaymentAdviceSequenceEntity } from './entities/gst-payment-advice-sequence.entity';
import { GST_PAYMENT_ADVICE_PREFIX } from './constants/gst.constants';

@Injectable()
export class GstRepository {
  constructor(
    @InjectRepository(GstRegisterEntryEntity)
    private readonly registerRepository: Repository<GstRegisterEntryEntity>,
    @InjectRepository(GstPaymentEntity)
    private readonly paymentRepository: Repository<GstPaymentEntity>,
    @InjectRepository(GstPaymentAdviceSequenceEntity)
    private readonly sequenceRepository: Repository<GstPaymentAdviceSequenceEntity>,
  ) {}

  // Register Entry methods
  async createRegisterEntry(
    data: Partial<GstRegisterEntryEntity>,
    em?: EntityManager,
  ): Promise<GstRegisterEntryEntity> {
    try {
      const repo = em
        ? em.getRepository(GstRegisterEntryEntity)
        : this.registerRepository;
      const row = repo.create(data);
      return await repo.save(row);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOneRegisterEntry(
    options: FindOneOptions<GstRegisterEntryEntity>,
    em?: EntityManager,
  ): Promise<GstRegisterEntryEntity | null> {
    try {
      const repo = em
        ? em.getRepository(GstRegisterEntryEntity)
        : this.registerRepository;
      return await repo.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAllRegisterEntries(
    options: FindManyOptions<GstRegisterEntryEntity>,
    em?: EntityManager,
  ): Promise<GstRegisterEntryEntity[]> {
    try {
      const repo = em
        ? em.getRepository(GstRegisterEntryEntity)
        : this.registerRepository;
      return await repo.find(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async countRegisterEntries(
    options: FindManyOptions<GstRegisterEntryEntity>,
    em?: EntityManager,
  ): Promise<number> {
    try {
      const repo = em
        ? em.getRepository(GstRegisterEntryEntity)
        : this.registerRepository;
      return await repo.count(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async updateRegisterEntry(
    where: FindOptionsWhere<GstRegisterEntryEntity>,
    data: Partial<GstRegisterEntryEntity>,
    em?: EntityManager,
  ): Promise<void> {
    try {
      const repo = em
        ? em.getRepository(GstRegisterEntryEntity)
        : this.registerRepository;
      await repo.update(where, data);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  // Payment methods
  async createPayment(
    data: Partial<GstPaymentEntity>,
    em?: EntityManager,
  ): Promise<GstPaymentEntity> {
    try {
      const repo = em
        ? em.getRepository(GstPaymentEntity)
        : this.paymentRepository;
      const row = repo.create(data);
      return await repo.save(row);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOnePayment(
    options: FindOneOptions<GstPaymentEntity>,
    em?: EntityManager,
  ): Promise<GstPaymentEntity | null> {
    try {
      const repo = em
        ? em.getRepository(GstPaymentEntity)
        : this.paymentRepository;
      return await repo.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAllPayments(
    options: FindManyOptions<GstPaymentEntity>,
    em?: EntityManager,
  ): Promise<GstPaymentEntity[]> {
    try {
      const repo = em
        ? em.getRepository(GstPaymentEntity)
        : this.paymentRepository;
      return await repo.find(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  /**
   * Get verified, unpaid GST entries for a vendor and month.
   */
  async getVerifiedUnpaidEntries(
    siteId: string,
    vendorId: string,
    paymentMonth: string,
    em?: EntityManager,
  ): Promise<GstRegisterEntryEntity[]> {
    const repo = em
      ? em.getRepository(GstRegisterEntryEntity)
      : this.registerRepository;
    return await repo.find({
      where: {
        siteId,
        vendorId,
        invoiceMonth: paymentMonth,
        partyType: 'PURCHASE',
        isVerified: true,
        gstPaymentId: null as any,
        deletedAt: null as any,
      },
    });
  }

  /**
   * Allocate GST payment advice sequence number.
   */
  async allocateGstPaymentSequence(
    financialYear: string,
    em: EntityManager,
  ): Promise<{ sequenceNumber: number; referenceNumber: string }> {
    await em.query(
      `SELECT pg_advisory_xact_lock(hashtext($1))`,
      [`gst_payment_seq_${financialYear}`],
    );

    const result = await em.query(
      `
        INSERT INTO gst_payment_advice_sequences ("financialYear", "lastSeq")
        VALUES ($1, 1)
        ON CONFLICT ("financialYear")
        DO UPDATE SET "lastSeq" = gst_payment_advice_sequences."lastSeq" + 1
        RETURNING "lastSeq"
      `,
      [financialYear],
    );

    const sequenceNumber = result[0].lastSeq;
    const referenceNumber = `${GST_PAYMENT_ADVICE_PREFIX}/${financialYear}/${String(sequenceNumber).padStart(3, '0')}`;

    return { sequenceNumber, referenceNumber };
  }
}
