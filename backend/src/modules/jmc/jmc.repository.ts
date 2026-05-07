import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  EntityManager,
  FindOneOptions,
  FindManyOptions,
  FindOptionsWhere,
} from 'typeorm';
import { JmcEntity } from './entities/jmc.entity';

@Injectable()
export class JmcRepository {
  constructor(
    @InjectRepository(JmcEntity)
    private readonly repository: Repository<JmcEntity>,
  ) {}

  private repo(em?: EntityManager) {
    return em ? em.getRepository(JmcEntity) : this.repository;
  }

  async create(data: Partial<JmcEntity>, em?: EntityManager): Promise<JmcEntity> {
    try {
      const repo = this.repo(em);
      const row = repo.create(data);
      return await repo.save(row);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(options: FindOneOptions<JmcEntity>, em?: EntityManager) {
    try {
      return await this.repo(em).findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(options: FindManyOptions<JmcEntity>, em?: EntityManager) {
    try {
      return await this.repo(em).find(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async count(options: FindManyOptions<JmcEntity>, em?: EntityManager) {
    try {
      return await this.repo(em).count(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    where: FindOptionsWhere<JmcEntity>,
    data: Partial<JmcEntity>,
    em?: EntityManager,
  ) {
    try {
      await this.repo(em).update(where, data);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async softDelete(where: FindOptionsWhere<JmcEntity>, em?: EntityManager) {
    try {
      await this.repo(em).softDelete(where);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
