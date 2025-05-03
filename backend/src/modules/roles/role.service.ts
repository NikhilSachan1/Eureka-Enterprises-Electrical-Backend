import { Injectable } from '@nestjs/common';
import { RoleRepository } from './role.repository';
import { RoleEntity } from './entities/role.entity';
import { FindOneOptions } from 'typeorm';

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
}
