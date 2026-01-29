import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  EntityManager,
  FindOneOptions,
  FindManyOptions,
  FindOptionsWhere,
} from 'typeorm';
import { DailyStatusReportEntity } from './entities/daily-status-report.entity';
import { DsrFileEntity } from './entities/dsr-file.entity';
import { DsrEditHistoryEntity } from './entities/dsr-edit-history.entity';

@Injectable()
export class DsrRepository {
  constructor(
    @InjectRepository(DailyStatusReportEntity)
    private readonly dsrRepository: Repository<DailyStatusReportEntity>,
    @InjectRepository(DsrFileEntity)
    private readonly dsrFileRepository: Repository<DsrFileEntity>,
    @InjectRepository(DsrEditHistoryEntity)
    private readonly dsrEditHistoryRepository: Repository<DsrEditHistoryEntity>,
  ) {}

  // DSR methods
  async create(
    createData: Partial<DailyStatusReportEntity>,
    entityManager?: EntityManager,
  ): Promise<DailyStatusReportEntity> {
    try {
      const repo = entityManager
        ? entityManager.getRepository(DailyStatusReportEntity)
        : this.dsrRepository;
      const dsr = repo.create(createData);
      return await repo.save(dsr);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(
    options: FindOneOptions<DailyStatusReportEntity>,
    entityManager?: EntityManager,
  ): Promise<DailyStatusReportEntity | null> {
    try {
      const repo = entityManager
        ? entityManager.getRepository(DailyStatusReportEntity)
        : this.dsrRepository;
      return await repo.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(
    options: FindManyOptions<DailyStatusReportEntity>,
    entityManager?: EntityManager,
  ): Promise<DailyStatusReportEntity[]> {
    try {
      const repo = entityManager
        ? entityManager.getRepository(DailyStatusReportEntity)
        : this.dsrRepository;
      return await repo.find(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<DailyStatusReportEntity>,
    updateData: Partial<DailyStatusReportEntity>,
    entityManager?: EntityManager,
  ): Promise<void> {
    try {
      const repo = entityManager
        ? entityManager.getRepository(DailyStatusReportEntity)
        : this.dsrRepository;
      await repo.update(identifierConditions, updateData);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async softDelete(
    identifierConditions: FindOptionsWhere<DailyStatusReportEntity>,
    entityManager?: EntityManager,
  ): Promise<void> {
    try {
      const repo = entityManager
        ? entityManager.getRepository(DailyStatusReportEntity)
        : this.dsrRepository;
      await repo.softDelete(identifierConditions);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async restore(
    identifierConditions: FindOptionsWhere<DailyStatusReportEntity>,
    entityManager?: EntityManager,
  ): Promise<void> {
    try {
      const repo = entityManager
        ? entityManager.getRepository(DailyStatusReportEntity)
        : this.dsrRepository;
      await repo.restore(identifierConditions);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async count(
    options: FindManyOptions<DailyStatusReportEntity>,
    entityManager?: EntityManager,
  ): Promise<number> {
    try {
      const repo = entityManager
        ? entityManager.getRepository(DailyStatusReportEntity)
        : this.dsrRepository;
      return await repo.count(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  // DSR File methods
  async createFile(
    createData: Partial<DsrFileEntity>,
    entityManager?: EntityManager,
  ): Promise<DsrFileEntity> {
    try {
      const repo = entityManager
        ? entityManager.getRepository(DsrFileEntity)
        : this.dsrFileRepository;
      const file = repo.create(createData);
      return await repo.save(file);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findFileOne(
    options: FindOneOptions<DsrFileEntity>,
    entityManager?: EntityManager,
  ): Promise<DsrFileEntity | null> {
    try {
      const repo = entityManager
        ? entityManager.getRepository(DsrFileEntity)
        : this.dsrFileRepository;
      return await repo.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAllFiles(
    options: FindManyOptions<DsrFileEntity>,
    entityManager?: EntityManager,
  ): Promise<DsrFileEntity[]> {
    try {
      const repo = entityManager
        ? entityManager.getRepository(DsrFileEntity)
        : this.dsrFileRepository;
      return await repo.find(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async softDeleteFile(
    identifierConditions: FindOptionsWhere<DsrFileEntity>,
    entityManager?: EntityManager,
  ): Promise<void> {
    try {
      const repo = entityManager
        ? entityManager.getRepository(DsrFileEntity)
        : this.dsrFileRepository;
      await repo.softDelete(identifierConditions);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  // DSR Edit History methods
  async createEditHistory(
    createData: Partial<DsrEditHistoryEntity>,
    entityManager?: EntityManager,
  ): Promise<DsrEditHistoryEntity> {
    try {
      const repo = entityManager
        ? entityManager.getRepository(DsrEditHistoryEntity)
        : this.dsrEditHistoryRepository;
      const history = repo.create(createData);
      return await repo.save(history);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findEditHistory(
    options: FindManyOptions<DsrEditHistoryEntity>,
    entityManager?: EntityManager,
  ): Promise<DsrEditHistoryEntity[]> {
    try {
      const repo = entityManager
        ? entityManager.getRepository(DsrEditHistoryEntity)
        : this.dsrEditHistoryRepository;
      return await repo.find(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
