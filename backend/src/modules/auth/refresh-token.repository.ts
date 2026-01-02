import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RefreshTokenEntity } from './entities/refresh-token.entity';
import { Repository, FindOneOptions, FindOptionsWhere, FindManyOptions } from 'typeorm';

@Injectable()
export class RefreshTokenRepository {
  constructor(
    @InjectRepository(RefreshTokenEntity)
    private repository: Repository<RefreshTokenEntity>,
  ) {}

  async create(refreshToken: Partial<RefreshTokenEntity>): Promise<RefreshTokenEntity> {
    try {
      return await this.repository.save(refreshToken);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(options: FindOneOptions<RefreshTokenEntity>): Promise<RefreshTokenEntity | null> {
    try {
      return await this.repository.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(options: FindManyOptions<RefreshTokenEntity>): Promise<RefreshTokenEntity[]> {
    try {
      return await this.repository.find(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    conditions: FindOptionsWhere<RefreshTokenEntity>,
    updateData: Partial<RefreshTokenEntity>,
  ) {
    try {
      return await this.repository.update(conditions, updateData);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async delete(conditions: FindOptionsWhere<RefreshTokenEntity>) {
    try {
      return await this.repository.delete(conditions);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
