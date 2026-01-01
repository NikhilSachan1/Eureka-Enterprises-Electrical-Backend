import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOneOptions, LessThan, Repository } from 'typeorm';
import { CronLogEntity } from './entities/cron-log.entity';

@Injectable()
export class CronLogRepository {
  constructor(
    @InjectRepository(CronLogEntity)
    private readonly repository: Repository<CronLogEntity>,
  ) {}

  async create(cronLog: Partial<CronLogEntity>): Promise<CronLogEntity> {
    try {
      return await this.repository.save(cronLog);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(options: FindOneOptions<CronLogEntity>): Promise<CronLogEntity | null> {
    try {
      return await this.repository.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(id: string, updateData: Partial<CronLogEntity>): Promise<void> {
    try {
      await this.repository.update(id, updateData);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async deleteOlderThan(date: Date): Promise<number> {
    try {
      const result = await this.repository.delete({
        createdAt: LessThan(date),
      });
      return result.affected || 0;
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async executeRawQuery(query: string, params: any[] = []): Promise<any[]> {
    try {
      return await this.repository.query(query, params);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
