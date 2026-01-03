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
import { CardsQueryDto } from './dto';
import { UtilityService } from 'src/utils/utility/utility.service';
import { SortOrder } from 'src/utils/utility/constants/utility.constants';

@Injectable()
export class CardsRepository {
  constructor(
    @InjectRepository(CardsEntity)
    private readonly repository: Repository<CardsEntity>,
    private readonly utilityService: UtilityService,
  ) {}
  async create(cards: Partial<CardsEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager ? entityManager.getRepository(CardsEntity) : this.repository;
      return await repository.save(cards);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(
    options: FindManyOptions<CardsEntity> & CardsQueryDto,
    entityManager?: EntityManager,
  ) {
    try {
      const repository = entityManager ? entityManager.getRepository(CardsEntity) : this.repository;
      const { search, page, pageSize, sortField, sortOrder, ...where } =
        options.where as FindOptionsWhere<CardsEntity> & CardsQueryDto;

      const queryBuilder = repository.createQueryBuilder('cards');

      queryBuilder.leftJoinAndSelect('cards.createdByUser', 'createdByUser');

      queryBuilder.where('cards.deletedAt IS NULL');

      if (search) {
        queryBuilder.andWhere(
          '(cards.cardNumber LIKE :search OR cards.cardType LIKE :search OR cards.cardName LIKE :search OR cards.holderName LIKE :search OR cards.expiryDate LIKE :search)',
          { search: `%${search}%` },
        );
      }

      if (sortField && sortOrder) {
        queryBuilder.orderBy(`cards.${sortField}`, sortOrder as SortOrder);
      } else {
        queryBuilder.orderBy('cards.createdAt', 'DESC');
      }

      if (page && pageSize) {
        queryBuilder.skip((page - 1) * pageSize);
        queryBuilder.take(pageSize);
      }

      if (where) {
        Object.keys(where).forEach((key) => {
          queryBuilder.andWhere(`cards.${key} = :${key}`, { [key]: where[key] });
        });
      }

      const [cards, total] = await queryBuilder.getManyAndCount();

      const mappedCards = cards.map((card) => ({
        ...card,
        createdByUser: card.createdByUser
          ? {
              id: card.createdByUser.id,
              firstName: card.createdByUser.firstName,
              lastName: card.createdByUser.lastName,
              email: card.createdByUser.email,
            }
          : null,
      }));

      return this.utilityService.listResponse(mappedCards, total);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(options: FindOneOptions<CardsEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager ? entityManager.getRepository(CardsEntity) : this.repository;
      const whereConditions = options.where as FindOptionsWhere<CardsEntity>;
      return await repository.findOne({
        ...options,
        where: {
          ...whereConditions,
          deletedAt: null,
        },
      });
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

  async delete(
    identifierConditions: FindOptionsWhere<CardsEntity>,
    deletedBy: string,
    entityManager?: EntityManager,
  ) {
    try {
      const repository = entityManager ? entityManager.getRepository(CardsEntity) : this.repository;
      return await repository.update(identifierConditions, {
        deletedAt: new Date(),
        deletedBy,
      });
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
