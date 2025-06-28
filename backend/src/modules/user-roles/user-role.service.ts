import { Injectable } from '@nestjs/common';
import { UserRoleRepository } from './user-role.repository';
import { EntityManager, FindOneOptions, FindOptionsWhere } from 'typeorm';
import { UserRoleEntity } from './entities/user-role.entity';

@Injectable()
export class UserRoleService {
  constructor(private userRoleRepository: UserRoleRepository) {}

  async create(userRole: Partial<UserRoleEntity>, entityManager?: EntityManager) {
    try {
      return await this.userRoleRepository.create(userRole, entityManager);
    } catch (error) {
      throw error;
    }
  }

  async findOne(options: FindOneOptions<UserRoleEntity>, entityManager?: EntityManager) {
    try {
      return await this.userRoleRepository.findOne(options, entityManager);
    } catch (error) {
      throw error;
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<UserRoleEntity>,
    updateData: Partial<UserRoleEntity>,
    entityManager: EntityManager,
  ) {
    try {
      return await this.userRoleRepository.update(identifierConditions, updateData, entityManager);
    } catch (error) {
      throw error;
    }
  }
}
