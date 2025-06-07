import { Injectable, NotFoundException } from '@nestjs/common';
import { RoleRepository } from './role.repository';
import { RoleEntity } from './entities/role.entity';
import { FindOneOptions } from 'typeorm';
import { ROLE_ERRORS } from './constants/role.constants';

@Injectable()
export class RoleService {
  constructor(private roleRepository: RoleRepository) {}

  async findOne(whereCondition: FindOneOptions<RoleEntity>): Promise<RoleEntity> {
    try {
      return this.roleRepository.findOne(whereCondition);
    } catch (error) {
      throw error;
    }
  }

  async findOneOrFail(whereCondition: FindOneOptions<RoleEntity>): Promise<RoleEntity> {
    try {
      const role = await this.roleRepository.findOne(whereCondition);
      if (!role) {
        throw new NotFoundException(ROLE_ERRORS.NOT_FOUND);
      }
      return role;
    } catch (error) {
      throw error;
    }
  }
}
