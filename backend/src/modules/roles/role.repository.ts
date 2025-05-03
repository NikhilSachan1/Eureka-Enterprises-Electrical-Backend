import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RoleEntity } from './entities/role.entity';
import { FindOneOptions, Repository } from 'typeorm';

@Injectable()
export class RoleRepository {
  constructor(
    @InjectRepository(RoleEntity)
    private repository: Repository<RoleEntity>,
  ) {}

  async findOne(query: FindOneOptions<RoleEntity>): Promise<RoleEntity> {
    try {
      return this.repository.findOne(query);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
