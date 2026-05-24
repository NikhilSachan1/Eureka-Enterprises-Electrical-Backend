import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  EntityManager,
  FindOneOptions,
  FindManyOptions,
  FindOptionsWhere,
  In,
} from 'typeorm';
import { TdsRegisterEntryEntity } from './entities/tds-register-entry.entity';
import { TdsPaymentEntity } from './entities/tds-payment.entity';

@Injectable()
export class TdsRepository {
  constructor(
    @InjectRepository(TdsRegisterEntryEntity)
    private readonly registerRepository: Repository<TdsRegisterEntryEntity>,
    @InjectRepository(TdsPaymentEntity)
    private readonly paymentRepository: Repository<TdsPaymentEntity>,
  ) {}

  // Register Entry methods
  async createRegisterEntry(
    data: Partial<TdsRegisterEntryEntity>,
    em?: EntityManager,
  ): Promise<TdsRegisterEntryEntity> {
    try {
      const repo = em ? em.getRepository(TdsRegisterEntryEntity) : this.registerRepository;
      const row = repo.create(data);
      return await repo.save(row);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOneRegisterEntry(
    options: FindOneOptions<TdsRegisterEntryEntity>,
    em?: EntityManager,
  ): Promise<TdsRegisterEntryEntity | null> {
    try {
      const repo = em ? em.getRepository(TdsRegisterEntryEntity) : this.registerRepository;
      return await repo.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAllRegisterEntries(
    options: FindManyOptions<TdsRegisterEntryEntity>,
    em?: EntityManager,
  ): Promise<TdsRegisterEntryEntity[]> {
    try {
      const repo = em ? em.getRepository(TdsRegisterEntryEntity) : this.registerRepository;
      return await repo.find(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async countRegisterEntries(
    options: FindManyOptions<TdsRegisterEntryEntity>,
    em?: EntityManager,
  ): Promise<number> {
    try {
      const repo = em ? em.getRepository(TdsRegisterEntryEntity) : this.registerRepository;
      return await repo.count(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async updateRegisterEntry(
    where: FindOptionsWhere<TdsRegisterEntryEntity>,
    data: Partial<TdsRegisterEntryEntity>,
    em?: EntityManager,
  ): Promise<void> {
    try {
      const repo = em ? em.getRepository(TdsRegisterEntryEntity) : this.registerRepository;
      await repo.update(where, data);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  // Payment methods
  async createPayment(
    data: Partial<TdsPaymentEntity>,
    em?: EntityManager,
  ): Promise<TdsPaymentEntity> {
    try {
      const repo = em ? em.getRepository(TdsPaymentEntity) : this.paymentRepository;
      const row = repo.create(data);
      return await repo.save(row);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOnePayment(
    options: FindOneOptions<TdsPaymentEntity>,
    em?: EntityManager,
  ): Promise<TdsPaymentEntity | null> {
    try {
      const repo = em ? em.getRepository(TdsPaymentEntity) : this.paymentRepository;
      return await repo.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAllPayments(
    options: FindManyOptions<TdsPaymentEntity>,
    em?: EntityManager,
  ): Promise<TdsPaymentEntity[]> {
    try {
      const repo = em ? em.getRepository(TdsPaymentEntity) : this.paymentRepository;
      return await repo.find(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  /**
   * Get verified, unpaid TDS entries for a party and month.
   */
  async getVerifiedUnpaidEntries(
    siteId: string,
    partyType: string,
    partyId: string,
    paymentMonth: string,
    em?: EntityManager,
  ): Promise<TdsRegisterEntryEntity[]> {
    const repo = em ? em.getRepository(TdsRegisterEntryEntity) : this.registerRepository;

    const where: any = {
      siteId,
      partyType,
      invoiceMonth: paymentMonth,
      isVerified: true,
      tdsPaymentId: null as any,
      deletedAt: null as any,
    };

    if (partyType === 'SALE') {
      where.contractorId = partyId;
    } else {
      where.vendorId = partyId;
    }

    return await repo.find({ where });
  }

  async getEntriesByIds(ids: string[], em?: EntityManager): Promise<TdsRegisterEntryEntity[]> {
    const repo = em ? em.getRepository(TdsRegisterEntryEntity) : this.registerRepository;
    return await repo.find({
      where: { id: In(ids), deletedAt: null as any },
    });
  }
}
