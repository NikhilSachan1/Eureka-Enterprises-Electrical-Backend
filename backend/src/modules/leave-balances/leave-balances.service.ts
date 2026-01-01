import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, FindManyOptions, FindOneOptions, FindOptionsWhere } from 'typeorm';
import { LeaveBalancesRepository } from './leave-balances.repository';
import { LeaveBalanceEntity } from './entities/leave-balance.entity';
import {
  LEAVE_BALANCE_ERRORS,
  LEAVE_BALANCE_FIELD_NAMES,
} from './constants/leave-balances.constants';
import { DataSuccessOperationType } from 'src/utils/utility/constants/utility.constants';
import { UtilityService } from 'src/utils/utility/utility.service';
import { GetAllLeaveBalanceDto } from './dto';
import { buildLeaveBalanceQuery } from './queries/leave-balances.queries';
import { CreateLeaveBalanceDto } from './types/leave-balances.types';

@Injectable()
export class LeaveBalancesService {
  constructor(
    private readonly leaveBalancesRepository: LeaveBalancesRepository,
    private readonly utilityService: UtilityService,
  ) {}

  async create(
    createDto: CreateLeaveBalanceDto,
    entityManager?: EntityManager,
  ): Promise<LeaveBalanceEntity> {
    const leaveBalance = {
      userId: createDto.userId,
      leaveConfigId: createDto.leaveConfigId,
      leaveCategory: createDto.leaveCategory,
      financialYear: createDto.financialYear,
      totalAllocated: createDto.totalAllocated,
      creditSource: createDto.creditSource,
      consumed: '0',
      carriedForward: '0',
      adjusted: '0',
      notes: createDto.notes,
      createdBy: createDto.createdBy,
    } as LeaveBalanceEntity;

    return await this.leaveBalancesRepository.create(leaveBalance, entityManager);
  }

  async findAll(options: FindManyOptions<LeaveBalanceEntity>): Promise<{
    records: LeaveBalanceEntity[];
    totalRecords: number;
  }> {
    return await this.leaveBalancesRepository.findAll(options);
  }

  async findOne(options: FindOneOptions<LeaveBalanceEntity>): Promise<LeaveBalanceEntity> {
    return await this.leaveBalancesRepository.findOne(options);
  }

  async findOneOrFail(options: FindOneOptions<LeaveBalanceEntity>): Promise<LeaveBalanceEntity> {
    try {
      const leaveBalance = await this.leaveBalancesRepository.findOne(options);

      if (!leaveBalance) {
        throw new NotFoundException(LEAVE_BALANCE_ERRORS.NOT_FOUND);
      }
      return leaveBalance;
    } catch (error) {
      throw error;
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<LeaveBalanceEntity>,
    updateData: Partial<LeaveBalanceEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      await this.findOneOrFail({ where: { id: identifierConditions.id } });
      await this.leaveBalancesRepository.update(identifierConditions, updateData, entityManager);
      return this.utilityService.getSuccessMessage(
        LEAVE_BALANCE_FIELD_NAMES.LEAVE_BALANCE,
        DataSuccessOperationType.UPDATE,
      );
    } catch (error) {
      throw error;
    }
  }

  async getAllLeaveBalances(options: GetAllLeaveBalanceDto): Promise<{
    records: LeaveBalanceEntity[];
    totalRecords: number;
  }> {
    const query = buildLeaveBalanceQuery(options);
    const records = await this.leaveBalancesRepository.rawQuery(query);
    return {
      records,
      totalRecords: records.length,
    };
  }
}
