import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  EntityManager,
  FindOneOptions,
  FindManyOptions,
  FindOptionsWhere,
} from 'typeorm';
import { CompanyBankAccountEntity } from './entities/company-bank-account.entity';

@Injectable()
export class CompanyBankAccountRepository {
  constructor(
    @InjectRepository(CompanyBankAccountEntity)
    private readonly repository: Repository<CompanyBankAccountEntity>,
  ) {}

  private repo(em?: EntityManager) {
    return em ? em.getRepository(CompanyBankAccountEntity) : this.repository;
  }

  async create(
    data: Partial<CompanyBankAccountEntity>,
    em?: EntityManager,
  ): Promise<CompanyBankAccountEntity> {
    try {
      return await this.repo(em).save(this.repo(em).create(data));
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(
    options: FindOneOptions<CompanyBankAccountEntity>,
    em?: EntityManager,
  ): Promise<CompanyBankAccountEntity | null> {
    return await this.repo(em).findOne(options);
  }

  async findAll(
    options: FindManyOptions<CompanyBankAccountEntity>,
    em?: EntityManager,
  ): Promise<CompanyBankAccountEntity[]> {
    return await this.repo(em).find(options);
  }

  async count(options: FindManyOptions<CompanyBankAccountEntity>, em?: EntityManager) {
    return await this.repo(em).count(options);
  }

  async update(
    where: FindOptionsWhere<CompanyBankAccountEntity>,
    data: Partial<CompanyBankAccountEntity>,
    em?: EntityManager,
  ) {
    await this.repo(em).update(where, data);
  }

  async softDelete(where: FindOptionsWhere<CompanyBankAccountEntity>, em?: EntityManager) {
    await this.repo(em).softDelete(where);
  }

  async raw(query: string, params: any[] = [], em?: EntityManager): Promise<any> {
    try {
      return await this.repo(em).query(query, params);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
