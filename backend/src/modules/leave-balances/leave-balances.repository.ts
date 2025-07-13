import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LeaveBalanceEntity } from './entities/leave-balance.entity';
import {
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { UtilityService } from 'src/utils/utility/utility.service';

@Injectable()
export class LeaveBalancesRepository {
  constructor(
    @InjectRepository(LeaveBalanceEntity)
    private readonly repository: Repository<LeaveBalanceEntity>,
    private readonly utilityService: UtilityService,
  ) {}

  async create(
    leaveBalance: LeaveBalanceEntity,
    entityManager?: EntityManager,
  ): Promise<LeaveBalanceEntity> {
    try {
      const repository = entityManager
        ? entityManager.getRepository(LeaveBalanceEntity)
        : this.repository;
      return await repository.save(leaveBalance);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(options: FindManyOptions<LeaveBalanceEntity>): Promise<{
    records: LeaveBalanceEntity[];
    totalRecords: number;
  }> {
    try {
      const [leaveBalances, totalRecords] = await this.repository.findAndCount({
        where: { deletedAt: null, ...options.where },
      });
      return this.utilityService.listResponse(leaveBalances, totalRecords);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(options: FindOneOptions<LeaveBalanceEntity>): Promise<LeaveBalanceEntity | null> {
    try {
      return await this.repository.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<LeaveBalanceEntity>,
    updateData: Partial<LeaveBalanceEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(LeaveBalanceEntity)
        : this.repository;
      return await repository.update(identifierConditions, updateData);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async rawQuery(query: string, parameters?: any[]) {
    try {
      return await this.repository.query(query, parameters);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
