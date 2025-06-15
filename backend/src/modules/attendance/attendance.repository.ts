import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  EntityManager,
  FindOptionsWhere,
  FindOneOptions,
  FindManyOptions,
} from 'typeorm';
import { AttendanceEntity } from './entities/attendance.entity';
import { UtilityService } from '../../utils/utility/utility.service';

@Injectable()
export class AttendanceRepository {
  constructor(
    @InjectRepository(AttendanceEntity)
    private readonly repository: Repository<AttendanceEntity>,
    private readonly utilityService: UtilityService,
  ) {}

  async findOne(
    options: FindOneOptions<AttendanceEntity>,
    entityManager?: EntityManager,
  ): Promise<AttendanceEntity | null> {
    const repository = entityManager
      ? entityManager.getRepository(AttendanceEntity)
      : this.repository;
    return await repository.findOne(options);
  }

  async findAll(
    options: FindManyOptions<AttendanceEntity>,
    entityManager?: EntityManager,
  ): Promise<{ records: AttendanceEntity[]; totalRecords: number }> {
    try {
      const repository = entityManager
        ? entityManager.getRepository(AttendanceEntity)
        : this.repository;

      const [attendances, total] = await repository.findAndCount(options);
      return this.utilityService.listResponse(attendances, total);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async create(
    attendanceData: Partial<AttendanceEntity>,
    entityManager?: EntityManager,
  ): Promise<AttendanceEntity> {
    try {
      const repository = entityManager
        ? entityManager.getRepository(AttendanceEntity)
        : this.repository;
      const attendance = repository.create(attendanceData);
      return await repository.save(attendance);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<AttendanceEntity>,
    updateData: Partial<AttendanceEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(AttendanceEntity)
        : this.repository;
      return await repository.update(identifierConditions, updateData);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async executeRawQuery(query: string, params: any[] = []): Promise<any | any[]> {
    try {
      return await this.repository.query(query, params);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
