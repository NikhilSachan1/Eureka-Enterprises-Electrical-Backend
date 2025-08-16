import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { CardsEntity } from './entities/card.entity';

@Injectable()
export class CardsRepository {
  constructor(
    @InjectRepository(CardsEntity)
    private readonly repository: Repository<CardsEntity>,
  ) {}
  async create(cards: Partial<CardsEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager ? entityManager.getRepository(CardsEntity) : this.repository;
      return await repository.save(cards);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(options: FindManyOptions<CardsEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager ? entityManager.getRepository(CardsEntity) : this.repository;
      return await repository.find(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(options: FindOneOptions<CardsEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager ? entityManager.getRepository(CardsEntity) : this.repository;
      return await repository.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<CardsEntity>,
    updateData: Partial<CardsEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      const repository = entityManager ? entityManager.getRepository(CardsEntity) : this.repository;
      return await repository.update(identifierConditions, updateData);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async delete(identifierConditions: FindOptionsWhere<CardsEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager ? entityManager.getRepository(CardsEntity) : this.repository;
      return await repository.delete(identifierConditions);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
