import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  EntityManager,
  FindOneOptions,
  FindManyOptions,
  FindOptionsWhere,
} from 'typeorm';
import { SiteInvoiceEntity } from './entities/site-invoice.entity';

@Injectable()
export class SiteInvoiceRepository {
  constructor(
    @InjectRepository(SiteInvoiceEntity)
    private readonly repository: Repository<SiteInvoiceEntity>,
  ) {}

  private repo(em?: EntityManager) {
    return em ? em.getRepository(SiteInvoiceEntity) : this.repository;
  }

  async create(data: Partial<SiteInvoiceEntity>, em?: EntityManager) {
    try {
      const repo = this.repo(em);
      const row = repo.create(data);
      return await repo.save(row);
    } catch (e) {
      throw new InternalServerErrorException(e);
    }
  }

  async findOne(options: FindOneOptions<SiteInvoiceEntity>, em?: EntityManager) {
    try {
      return await this.repo(em).findOne(options);
    } catch (e) {
      throw new InternalServerErrorException(e);
    }
  }

  async findAll(options: FindManyOptions<SiteInvoiceEntity>, em?: EntityManager) {
    try {
      return await this.repo(em).find(options);
    } catch (e) {
      throw new InternalServerErrorException(e);
    }
  }

  async count(options: FindManyOptions<SiteInvoiceEntity>, em?: EntityManager) {
    try {
      return await this.repo(em).count(options);
    } catch (e) {
      throw new InternalServerErrorException(e);
    }
  }

  async update(
    where: FindOptionsWhere<SiteInvoiceEntity>,
    data: Partial<SiteInvoiceEntity>,
    em?: EntityManager,
  ) {
    try {
      await this.repo(em).update(where, data);
    } catch (e) {
      throw new InternalServerErrorException(e);
    }
  }

  async softDelete(where: FindOptionsWhere<SiteInvoiceEntity>, em?: EntityManager) {
    try {
      await this.repo(em).softDelete(where);
    } catch (e) {
      throw new InternalServerErrorException(e);
    }
  }

  async findOneForUpdate(id: string, em: EntityManager): Promise<SiteInvoiceEntity | null> {
    return await em
      .getRepository(SiteInvoiceEntity)
      .createQueryBuilder('inv')
      .setLock('pessimistic_write')
      .where('inv.id = :id', { id })
      .andWhere('inv."deletedAt" IS NULL')
      .getOne();
  }

  async adjustRollups(
    id: string,
    delta: { bookedTotal?: number; paidTotal?: number },
    em: EntityManager,
  ): Promise<void> {
    const setClauses: string[] = [];
    const params: any[] = [];

    if (delta.bookedTotal !== undefined) {
      params.push(delta.bookedTotal);
      setClauses.push(`"bookedTotal" = "bookedTotal" + $${params.length}`);
    }
    if (delta.paidTotal !== undefined) {
      params.push(delta.paidTotal);
      setClauses.push(`"paidTotal" = "paidTotal" + $${params.length}`);
    }
    if (setClauses.length === 0) return;
    params.push(id);
    await em.query(
      `UPDATE site_invoices SET ${setClauses.join(', ')} WHERE id = $${params.length}`,
      params,
    );
  }
}
