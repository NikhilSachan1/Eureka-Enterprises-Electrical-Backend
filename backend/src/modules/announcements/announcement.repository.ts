import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { AnnouncementEntity } from './entities/announcement.entity';
import { AnnouncementTargetEntity } from './entities/announcement-target.entity';
import { UserAnnouncementAckEntity } from './entities/user-announcement-ack.entity';
import { UtilityService } from 'src/utils/utility/utility.service';

@Injectable()
export class AnnouncementRepository {
  constructor(
    @InjectRepository(AnnouncementEntity)
    private readonly repository: Repository<AnnouncementEntity>,
    @InjectRepository(AnnouncementTargetEntity)
    private readonly targetRepository: Repository<AnnouncementTargetEntity>,
    @InjectRepository(UserAnnouncementAckEntity)
    private readonly ackRepository: Repository<UserAnnouncementAckEntity>,
    private readonly utilityService: UtilityService,
  ) {}

  async create(data: Partial<AnnouncementEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(AnnouncementEntity)
        : this.repository;
      return await repository.save(data);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(options: FindOneOptions<AnnouncementEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(AnnouncementEntity)
        : this.repository;
      return await repository.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(options: FindManyOptions<AnnouncementEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(AnnouncementEntity)
        : this.repository;
      const [records, totalRecords] = await repository.findAndCount(options);
      return this.utilityService.listResponse(records, totalRecords);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<AnnouncementEntity>,
    updateData: Partial<AnnouncementEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(AnnouncementEntity)
        : this.repository;
      return await repository.update(identifierConditions, updateData);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async executeRawQuery(query: string, params: any[], entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(AnnouncementEntity)
        : this.repository;
      return await repository.query(query, params);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  // ==================== Target Methods ====================

  async createTargets(targets: Partial<AnnouncementTargetEntity>[], entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(AnnouncementTargetEntity)
        : this.targetRepository;
      return await repository.save(targets);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async deleteTargets(
    conditions: FindOptionsWhere<AnnouncementTargetEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(AnnouncementTargetEntity)
        : this.targetRepository;
      return await repository.delete(conditions);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findTargets(
    options: FindManyOptions<AnnouncementTargetEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(AnnouncementTargetEntity)
        : this.targetRepository;
      return await repository.find(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  // ==================== Acknowledgement Methods ====================

  async findAck(options: FindOneOptions<UserAnnouncementAckEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(UserAnnouncementAckEntity)
        : this.ackRepository;
      return await repository.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async saveAck(data: Partial<UserAnnouncementAckEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(UserAnnouncementAckEntity)
        : this.ackRepository;
      return await repository.save(data);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
