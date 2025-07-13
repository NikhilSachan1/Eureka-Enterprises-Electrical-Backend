import { Injectable } from '@nestjs/common';
import { UserRoleRepository } from './user-role.repository';
import { EntityManager, FindOneOptions, FindOptionsWhere } from 'typeorm';
import { UserRoleEntity } from './entities/user-role.entity';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UtilityService } from '../../utils/utility/utility.service';
import { USER_ROLE_FIELD_NAMES } from './constants/user-role.constants';
import { DataSuccessOperationType } from 'src/utils/utility/constants/utility.constants';

@Injectable()
export class UserRoleService {
  constructor(
    private userRoleRepository: UserRoleRepository,
    private readonly utilityService: UtilityService,
  ) {}

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
    entityManager?: EntityManager,
  ) {
    try {
      return await this.userRoleRepository.update(identifierConditions, updateData, entityManager);
    } catch (error) {
      throw error;
    }
  }

  async updateUserRole(id: string, updateUserRoleDto: UpdateUserRoleDto) {
    await this.update({ id }, updateUserRoleDto);
    // TODO: delete user permissions overrides for the user
    return {
      message: this.utilityService.getSuccessMessage(
        USER_ROLE_FIELD_NAMES.USER_ROLE,
        DataSuccessOperationType.UPDATE,
      ),
    };
  }
}
