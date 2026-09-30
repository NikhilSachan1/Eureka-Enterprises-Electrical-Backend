import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { PetroCardWalletRechargeEntity } from './entities/petro-card-wallet-recharge.entity';

@Injectable()
export class PetroCardWalletRepository {
  constructor(
    @InjectRepository(PetroCardWalletRechargeEntity)
    private readonly repository: Repository<PetroCardWalletRechargeEntity>,
  ) {}

  private repo(em?: EntityManager) {
    return em ? em.getRepository(PetroCardWalletRechargeEntity) : this.repository;
  }

  async create(data: Partial<PetroCardWalletRechargeEntity>, em?: EntityManager) {
    try {
      const repo = this.repo(em);
      return await repo.save(repo.create(data));
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(options: FindOneOptions<PetroCardWalletRechargeEntity>, em?: EntityManager) {
    try {
      return await this.repo(em).findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAndCount(options: FindManyOptions<PetroCardWalletRechargeEntity>, em?: EntityManager) {
    try {
      return await this.repo(em).findAndCount(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    where: FindOptionsWhere<PetroCardWalletRechargeEntity>,
    data: Partial<PetroCardWalletRechargeEntity>,
    em?: EntityManager,
  ) {
    try {
      return await this.repo(em).update(where, data);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async softDelete(where: FindOptionsWhere<PetroCardWalletRechargeEntity>, em?: EntityManager) {
    try {
      return await this.repo(em).softDelete(where);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
