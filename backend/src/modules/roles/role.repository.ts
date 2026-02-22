import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RoleEntity } from './entities/role.entity';
import {
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
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

  async findAll(options: FindManyOptions<RoleEntity>): Promise<{
    records: (RoleEntity & { permissionCount: number })[];
    totalRecords: number;
  }> {
    try {
      const where = options.where as FindOptionsWhere<RoleEntity>;

      const queryBuilder = this.repository
        .createQueryBuilder('role')
        .leftJoin('role.rolePermissions', 'rolePermission', 'rolePermission.isActive = true')
        .select([
          'role.id',
          'role.name',
          'role.label',
          'role.description',
          'role.isEditable',
          'role.isDeletable',
          'role.createdAt',
          'role.updatedAt',
          'role.deletedAt',
        ])
        .addSelect('COUNT(rolePermission.id)', 'permissionCount')
        .where('role.deletedAt IS NULL')
        .groupBy('role.id');

      // Filter by names (multiple)
      if ((where as any)?.names && (where as any).names.length > 0) {
        queryBuilder.andWhere('role.name IN (:...names)', { names: (where as any).names });
      }

      // Search by label (using 'search' field passed from service)
      if ((where as any)?.search) {
        queryBuilder.andWhere('role.label ILIKE :search', { search: `%${(where as any).search}%` });
      }

      // Get total count before pagination
      const total = await queryBuilder.getCount();

      // Apply sorting
      if (options.order) {
        const orderEntries = Object.entries(options.order);
        if (orderEntries.length > 0) {
          const [field, direction] = orderEntries[0];
          queryBuilder.orderBy(`role.${field}`, direction as 'ASC' | 'DESC');
        }
      } else {
        queryBuilder.orderBy('role.createdAt', 'DESC');
      }

      // Apply pagination
      if (options.skip !== undefined) {
        queryBuilder.offset(options.skip);
      }
      if (options.take !== undefined) {
        queryBuilder.limit(options.take);
      }

      const roles = await queryBuilder.getRawAndEntities();

      const rolesWithPermissionCount = roles.entities.map((role, index) => ({
        ...role,
        permissionCount: parseInt(roles.raw[index].permissionCount) || 0,
      }));

      return this.utilityService.listResponse(rolesWithPermissionCount, total);
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
