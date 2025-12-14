import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, FindManyOptions, FindOptionsWhere, Repository } from 'typeorm';
import { UserDocumentEntity } from './entities/user-document.entity';

@Injectable()
export class UserDocumentRepository {
  constructor(
    @InjectRepository(UserDocumentEntity)
    private readonly repository: Repository<UserDocumentEntity>,
  ) {}

  async create(
    userDocument: Partial<UserDocumentEntity>,
    entityManager?: EntityManager,
  ): Promise<UserDocumentEntity> {
    try {
      const repository = entityManager
        ? entityManager.getRepository(UserDocumentEntity)
        : this.repository;
      return await repository.save(userDocument);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(
    options: FindManyOptions<UserDocumentEntity>,
    entityManager?: EntityManager,
  ): Promise<UserDocumentEntity[]> {
    try {
      const repository = entityManager
        ? entityManager.getRepository(UserDocumentEntity)
        : this.repository;
      return await repository.find(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<UserDocumentEntity>,
    updateData: Partial<UserDocumentEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(UserDocumentEntity)
        : this.repository;
      return await repository.update(identifierConditions, updateData);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async delete(id: string, deletedBy: string, entityManager?: EntityManager): Promise<void> {
    try {
      const repository = entityManager
        ? entityManager.getRepository(UserDocumentEntity)
        : this.repository;
      await repository.update(id, { deletedBy });
      await repository.softDelete(id);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async deleteByCondition(
    conditions: FindOptionsWhere<UserDocumentEntity>,
    deletedBy: string,
    entityManager?: EntityManager,
  ): Promise<void> {
    try {
      const repository = entityManager
        ? entityManager.getRepository(UserDocumentEntity)
        : this.repository;
      await repository.update(conditions, { deletedBy });
      await repository.softDelete(conditions);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
