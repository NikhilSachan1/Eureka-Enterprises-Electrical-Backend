import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LeaveApplicationsEntity } from './entities/leave-application.entity';
import {
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { CreateLeaveApplicationDto } from './dto';
import { UtilityService } from 'src/utils/utility/utility.service';

@Injectable()
export class LeaveApplicationsRepository {
  constructor(
    @InjectRepository(LeaveApplicationsEntity)
    private readonly repository: Repository<LeaveApplicationsEntity>,
    private readonly utilityService: UtilityService,
  ) {}

  async create(
    leaveApplication: Partial<LeaveApplicationsEntity> | CreateLeaveApplicationDto,
    entityManager?: EntityManager,
  ): Promise<LeaveApplicationsEntity> {
    try {
      const repository = entityManager
        ? entityManager.getRepository(LeaveApplicationsEntity)
        : this.repository;
      return await repository.save(leaveApplication);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(options: FindManyOptions<LeaveApplicationsEntity>): Promise<{
    records: LeaveApplicationsEntity[];
    totalRecords: number;
  }> {
    try {
      const [leaveApplications, totalRecords] = await this.repository.findAndCount({
        where: { deletedAt: null, ...options.where },
      });
      return this.utilityService.listResponse(leaveApplications, totalRecords);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(
    options: FindOneOptions<LeaveApplicationsEntity>,
    entityManager?: EntityManager,
  ): Promise<LeaveApplicationsEntity | null> {
    try {
      const repository = entityManager
        ? entityManager.getRepository(LeaveApplicationsEntity)
        : this.repository;
      return await repository.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOneOrFail(
    options: FindOneOptions<LeaveApplicationsEntity>,
  ): Promise<LeaveApplicationsEntity> {
    try {
      return await this.repository.findOneOrFail(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<LeaveApplicationsEntity>,
    updateData: Partial<LeaveApplicationsEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(LeaveApplicationsEntity)
        : this.repository;
      return await repository.update(identifierConditions, updateData);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async delete(
    identifierConditions: FindOptionsWhere<LeaveApplicationsEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(LeaveApplicationsEntity)
        : this.repository;
      return await repository.softDelete(identifierConditions);
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
