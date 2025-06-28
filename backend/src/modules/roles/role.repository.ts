import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RoleEntity } from './entities/role.entity';
import { EntityManager, FindOneOptions, FindOptionsWhere, Repository } from 'typeorm';
import { CreateRoleDto } from './dto';
import { UtilityService } from 'src/utils/utility/utility.service';

@Injectable()
export class RoleRepository {
  constructor(
    @InjectRepository(RoleEntity)
    private repository: Repository<RoleEntity>,
    private utilityService: UtilityService,
  ) {}

  async create(createRoleDto: CreateRoleDto, entityManager?: EntityManager): Promise<RoleEntity> {
    try {
      const repository = entityManager ? entityManager.getRepository(RoleEntity) : this.repository;
      return await repository.save(createRoleDto);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(query: FindOneOptions<RoleEntity>): Promise<RoleEntity> {
    try {
      return this.repository.findOne(query);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(options: FindOptionsWhere<RoleEntity>): Promise<{
    records: RoleEntity[];
    totalRecords: number;
  }> {
    try {
      const [roles, total] = await this.repository.findAndCount({
        where: options,
      });
      return this.utilityService.listResponse(roles, total);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<RoleEntity>,
    updateData: Partial<RoleEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      const repository = entityManager ? entityManager.getRepository(RoleEntity) : this.repository;
      const updateResult = await repository.update(identifierConditions, updateData);
      return updateResult;
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
