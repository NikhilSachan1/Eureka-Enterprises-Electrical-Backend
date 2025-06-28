import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { RoleRepository } from './role.repository';
import { RoleEntity } from './entities/role.entity';
import { EntityManager, FindOneOptions, FindOptionsWhere } from 'typeorm';
import { ROLE_ERRORS, ROLE_FIELD_NAMES } from './constants/role.constants';
import { CreateRoleDto } from './dto';
import { DataSuccessOperationType } from 'src/utils/utility/constants/utility.constants';
import { UtilityService } from 'src/utils/utility/utility.service';

@Injectable()
export class RoleService {
  constructor(private roleRepository: RoleRepository, private utilityService: UtilityService) {}

  async create(createRoleDto: CreateRoleDto): Promise<RoleEntity> {
    try {
      const existingRole = await this.roleRepository.findOne({
        where: { name: createRoleDto.name },
      });
      if (existingRole) throw new ConflictException(ROLE_ERRORS.ALREADY_EXISTS);
      return await this.roleRepository.create(createRoleDto);
    } catch (error) {
      throw error;
    }
  }

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

  async findAll(options: FindOptionsWhere<RoleEntity>): Promise<{
    records: RoleEntity[];
    totalRecords: number;
  }> {
    try {
      return await this.roleRepository.findAll(options);
    } catch (error) {
      throw error;
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<RoleEntity>,
    updateData: Partial<RoleEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      await this.findOneOrFail({
        where: identifierConditions,
      });
      await this.roleRepository.update(identifierConditions, updateData, entityManager);
      return this.utilityService.getSuccessMessage(
        ROLE_FIELD_NAMES.ROLE,
        DataSuccessOperationType.UPDATE,
      );
    } catch (error) {
      throw error;
    }
  }
}
