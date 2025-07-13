import { Injectable, NotFoundException } from '@nestjs/common';
import { FindManyOptions, FindOneOptions } from 'typeorm';
import { LeaveBalancesRepository } from './leave-balances.repository';
import { LeaveBalanceEntity } from './entities/leave-balance.entity';
import { LEAVE_BALANCE_ERRORS } from './constants/leave-balances.constants';

@Injectable()
export class LeaveBalancesService {
  constructor(private readonly leaveBalancesRepository: LeaveBalancesRepository) {}

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
}
