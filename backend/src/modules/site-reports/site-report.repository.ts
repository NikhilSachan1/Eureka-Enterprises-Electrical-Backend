import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  EntityManager,
  FindOneOptions,
  FindManyOptions,
  FindOptionsWhere,
} from 'typeorm';
import { SiteReportEntity } from './entities/site-report.entity';

@Injectable()
export class SiteReportRepository {
  constructor(
    @InjectRepository(SiteReportEntity)
    private readonly repository: Repository<SiteReportEntity>,
  ) {}

  private repo(em?: EntityManager) {
    return em ? em.getRepository(SiteReportEntity) : this.repository;
  }

  async create(data: Partial<SiteReportEntity>, em?: EntityManager) {
    try {
      const repo = this.repo(em);
      const row = repo.create(data);
      return await repo.save(row);
    } catch (e) {
      throw new InternalServerErrorException(e);
    }
  }

  async findOne(options: FindOneOptions<SiteReportEntity>, em?: EntityManager) {
    try {
      return await this.repo(em).findOne(options);
    } catch (e) {
      throw new InternalServerErrorException(e);
    }
  }

  async findAll(options: FindManyOptions<SiteReportEntity>, em?: EntityManager) {
    try {
      return await this.repo(em).find(options);
    } catch (e) {
      throw new InternalServerErrorException(e);
    }
  }

  async count(options: FindManyOptions<SiteReportEntity>, em?: EntityManager) {
    try {
      return await this.repo(em).count(options);
    } catch (e) {
      throw new InternalServerErrorException(e);
    }
  }

  async update(
    where: FindOptionsWhere<SiteReportEntity>,
    data: Partial<SiteReportEntity>,
    em?: EntityManager,
  ) {
    try {
      await this.repo(em).update(where, data);
    } catch (e) {
      throw new InternalServerErrorException(e);
    }
  }

  async softDelete(where: FindOptionsWhere<SiteReportEntity>, em?: EntityManager) {
    try {
      await this.repo(em).softDelete(where);
    } catch (e) {
      throw new InternalServerErrorException(e);
    }
  }
}
