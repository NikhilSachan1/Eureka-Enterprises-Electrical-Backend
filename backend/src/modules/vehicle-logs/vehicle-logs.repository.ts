import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { VehicleLogEntity } from './entities/vehicle-log.entity';
import { VehicleLogFileEntity } from './entities/vehicle-log-file.entity';

@Injectable()
export class VehicleLogsRepository {
  constructor(
    @InjectRepository(VehicleLogEntity)
    private readonly repository: Repository<VehicleLogEntity>,
    @InjectRepository(VehicleLogFileEntity)
    private readonly fileRepository: Repository<VehicleLogFileEntity>,
  ) {}

  // Vehicle Log methods
  async create(vehicleLog: Partial<VehicleLogEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(VehicleLogEntity)
        : this.repository;
      return await repository.save(vehicleLog);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(options: FindOneOptions<VehicleLogEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(VehicleLogEntity)
        : this.repository;
      return await repository.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(options: FindManyOptions<VehicleLogEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(VehicleLogEntity)
        : this.repository;
      return await repository.findAndCount(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<VehicleLogEntity>,
    updateData: Partial<VehicleLogEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(VehicleLogEntity)
        : this.repository;
      return await repository.update(identifierConditions, updateData);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async count(options: FindManyOptions<VehicleLogEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(VehicleLogEntity)
        : this.repository;
      return await repository.count(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  // Vehicle Log File methods
  async createFile(file: Partial<VehicleLogFileEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(VehicleLogFileEntity)
        : this.fileRepository;
      return await repository.save(file);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async createFiles(files: Partial<VehicleLogFileEntity>[], entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(VehicleLogFileEntity)
        : this.fileRepository;
      return await repository.save(files);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findFiles(options: FindManyOptions<VehicleLogFileEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(VehicleLogFileEntity)
        : this.fileRepository;
      return await repository.find(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async deleteFile(
    identifierConditions: FindOptionsWhere<VehicleLogFileEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(VehicleLogFileEntity)
        : this.fileRepository;
      return await repository.delete(identifierConditions);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async softDeleteFilesByType(
    vehicleLogId: string,
    fileType: string,
    entityManager?: EntityManager,
  ) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(VehicleLogFileEntity)
        : this.fileRepository;
      return await repository.softDelete({ vehicleLogId, fileType });
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
