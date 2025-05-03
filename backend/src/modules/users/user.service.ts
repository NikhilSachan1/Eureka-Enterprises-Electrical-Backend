import { Injectable, NotFoundException } from '@nestjs/common';
import { UserEntity } from './entities/user.entity';
import { UserRepository } from './user.repository';
import { UtilityService } from 'src/utils/utility/utility.service';
import { USERS_ERRORS, USER_FIELD_NAMES } from './constants/user.constants';
import { DataSuccessOperationType } from 'src/utils/utility/constants/utility.constants';
import { FindOptionsWhere } from 'typeorm';
import { GetUsersDto } from './dto';

@Injectable()
export class UserService {
  constructor(private userRepository: UserRepository, private utilityService: UtilityService) {}

  async findAll(
    options: GetUsersDto,
  ): Promise<{ records: UserEntity[]; totalRecords: number } | undefined> {
    try {
      const users = await this.userRepository.findAll(options);
      return users;
    } catch (error) {
      throw error;
    }
  }

  async findOne(options: FindOptionsWhere<UserEntity>) {
    try {
      const user = await this.userRepository.findOne({ where: options });
      return user;
    } catch (error) {
      throw error;
    }
  }

  async create(
    user: Partial<UserEntity & { roleId: string; invitationId: string }>,
  ): Promise<UserEntity> {
    try {
      return await this.userRepository.create(user as any);
    } catch (error) {
      throw error;
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<UserEntity>,
    updateData: Partial<UserEntity>,
  ) {
    try {
      const user = await this.userRepository.findOne({
        where: identifierConditions,
      });
      if (!user) throw new NotFoundException(USERS_ERRORS.NOT_FOUND);
      await this.userRepository.update(identifierConditions, updateData);
      return this.utilityService.getSuccessMessage(
        USER_FIELD_NAMES.USER,
        DataSuccessOperationType.UPDATE,
      );
    } catch (error) {
      throw error;
    }
  }

  async delete(id: string, deletedBy: string) {
    try {
      await this.userRepository.delete(id, deletedBy);

      return this.utilityService.getSuccessMessage(
        USER_FIELD_NAMES.USER,
        DataSuccessOperationType.DELETE,
      );
    } catch (error) {
      throw error;
    }
  }
}
