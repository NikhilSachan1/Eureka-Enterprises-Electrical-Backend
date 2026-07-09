import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  EntityManager,
  FindOneOptions,
  FindManyOptions,
  FindOptionsWhere,
} from 'typeorm';
import { PaymentSheetEntity } from './entities/payment-sheet.entity';
import { PaymentSheetItemEntity } from './entities/payment-sheet-item.entity';
import { PaymentSheetItemBookPaymentEntity } from './entities/payment-sheet-item-book-payment.entity';
import { PaymentSheetItemHistoryEntity } from './entities/payment-sheet-item-history.entity';
import { PaymentSheetStageLogEntity } from './entities/payment-sheet-stage-log.entity';
import { PaymentSheetItemVerificationEntity } from './entities/payment-sheet-item-verification.entity';

@Injectable()
export class PaymentSheetRepository {
  constructor(
    @InjectRepository(PaymentSheetEntity)
    private readonly sheetRepo: Repository<PaymentSheetEntity>,
    @InjectRepository(PaymentSheetItemEntity)
    private readonly itemRepo: Repository<PaymentSheetItemEntity>,
    @InjectRepository(PaymentSheetItemBookPaymentEntity)
    private readonly allocRepo: Repository<PaymentSheetItemBookPaymentEntity>,
    @InjectRepository(PaymentSheetItemHistoryEntity)
    private readonly historyRepo: Repository<PaymentSheetItemHistoryEntity>,
    @InjectRepository(PaymentSheetStageLogEntity)
    private readonly stageLogRepo: Repository<PaymentSheetStageLogEntity>,
    @InjectRepository(PaymentSheetItemVerificationEntity)
    private readonly verificationRepo: Repository<PaymentSheetItemVerificationEntity>,
  ) {}

  private sheets(em?: EntityManager) {
    return em ? em.getRepository(PaymentSheetEntity) : this.sheetRepo;
  }
  private items(em?: EntityManager) {
    return em ? em.getRepository(PaymentSheetItemEntity) : this.itemRepo;
  }
  private allocs(em?: EntityManager) {
    return em ? em.getRepository(PaymentSheetItemBookPaymentEntity) : this.allocRepo;
  }
  private history(em?: EntityManager) {
    return em ? em.getRepository(PaymentSheetItemHistoryEntity) : this.historyRepo;
  }
  private stageLogs(em?: EntityManager) {
    return em ? em.getRepository(PaymentSheetStageLogEntity) : this.stageLogRepo;
  }

  // ── Sheets ──
  async createSheet(data: Partial<PaymentSheetEntity>, em?: EntityManager) {
    try {
      return await this.sheets(em).save(this.sheets(em).create(data));
    } catch (e) {
      throw new InternalServerErrorException(e);
    }
  }
  async findSheet(options: FindOneOptions<PaymentSheetEntity>, em?: EntityManager) {
    return await this.sheets(em).findOne(options);
  }
  async findSheets(options: FindManyOptions<PaymentSheetEntity>, em?: EntityManager) {
    return await this.sheets(em).find(options);
  }
  async countSheets(options: FindManyOptions<PaymentSheetEntity>, em?: EntityManager) {
    return await this.sheets(em).count(options);
  }
  async updateSheet(
    where: FindOptionsWhere<PaymentSheetEntity>,
    data: Partial<PaymentSheetEntity>,
    em?: EntityManager,
  ) {
    await this.sheets(em).update(where, data);
  }
  async findSheetForUpdate(id: string, em: EntityManager) {
    return await em
      .getRepository(PaymentSheetEntity)
      .createQueryBuilder('ps')
      .setLock('pessimistic_write')
      .where('ps.id = :id', { id })
      .andWhere('ps."deletedAt" IS NULL')
      .getOne();
  }

  // ── Items ──
  async createItem(data: Partial<PaymentSheetItemEntity>, em?: EntityManager) {
    return await this.items(em).save(this.items(em).create(data));
  }
  async findItems(options: FindManyOptions<PaymentSheetItemEntity>, em?: EntityManager) {
    return await this.items(em).find(options);
  }
  async findItem(options: FindOneOptions<PaymentSheetItemEntity>, em?: EntityManager) {
    return await this.items(em).findOne(options);
  }
  async updateItem(
    where: FindOptionsWhere<PaymentSheetItemEntity>,
    data: Partial<PaymentSheetItemEntity>,
    em?: EntityManager,
  ) {
    await this.items(em).update(where, data);
  }
  async softDeleteItem(where: FindOptionsWhere<PaymentSheetItemEntity>, em?: EntityManager) {
    await this.items(em).softDelete(where);
  }

  // ── Allocations ──
  async createAllocation(data: Partial<PaymentSheetItemBookPaymentEntity>, em?: EntityManager) {
    return await this.allocs(em).save(this.allocs(em).create(data));
  }
  async findAllocations(
    options: FindManyOptions<PaymentSheetItemBookPaymentEntity>,
    em?: EntityManager,
  ) {
    return await this.allocs(em).find(options);
  }
  async updateAllocation(
    where: FindOptionsWhere<PaymentSheetItemBookPaymentEntity>,
    data: Partial<PaymentSheetItemBookPaymentEntity>,
    em?: EntityManager,
  ) {
    await this.allocs(em).update(where, data);
  }
  async softDeleteAllocation(
    where: FindOptionsWhere<PaymentSheetItemBookPaymentEntity>,
    em?: EntityManager,
  ) {
    await this.allocs(em).softDelete(where);
  }

  // ── History & stage logs ──
  async addHistory(data: Partial<PaymentSheetItemHistoryEntity>, em?: EntityManager) {
    return await this.history(em).save(this.history(em).create(data));
  }
  async findHistory(options: FindManyOptions<PaymentSheetItemHistoryEntity>, em?: EntityManager) {
    return await this.history(em).find(options);
  }
  async addStageLog(data: Partial<PaymentSheetStageLogEntity>, em?: EntityManager) {
    return await this.stageLogs(em).save(this.stageLogs(em).create(data));
  }
  async findStageLogs(options: FindManyOptions<PaymentSheetStageLogEntity>, em?: EntityManager) {
    return await this.stageLogs(em).find(options);
  }

  // ── Item verifications (per item × stage) ──
  private verifications(em?: EntityManager) {
    return em ? em.getRepository(PaymentSheetItemVerificationEntity) : this.verificationRepo;
  }
  async createVerification(data: Partial<PaymentSheetItemVerificationEntity>, em?: EntityManager) {
    return await this.verifications(em).save(this.verifications(em).create(data));
  }
  async findVerifications(
    options: FindManyOptions<PaymentSheetItemVerificationEntity>,
    em?: EntityManager,
  ) {
    return await this.verifications(em).find(options);
  }
  async findVerification(
    options: FindOneOptions<PaymentSheetItemVerificationEntity>,
    em?: EntityManager,
  ) {
    return await this.verifications(em).findOne(options);
  }
  /** Hard-delete all verification rows for an item (used when its amount changes). */
  async deleteVerificationsByItem(itemId: string, em?: EntityManager) {
    await this.verifications(em).delete({ itemId });
  }
  /** Hard-delete the verification row for a specific (item, stage). */
  async deleteVerification(itemId: string, stage: string, em?: EntityManager) {
    await this.verifications(em).delete({ itemId, stage });
  }

  // ── Raw ──
  async raw(query: string, params: any[] = [], em?: EntityManager): Promise<any> {
    try {
      return await this.sheets(em).query(query, params);
    } catch (e) {
      throw new InternalServerErrorException(e);
    }
  }
}
