import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateCardDto } from './dto';
import { CardsRepository } from './cards.repository';
import { CardsEntity } from './entities/card.entity';
import { EntityManager, FindManyOptions, FindOneOptions, FindOptionsWhere } from 'typeorm';
import { CARD_ERRORS, CardsEntityFields } from './constants/card.constants';
import { UtilityService } from 'src/utils/utility/utility.service';
import { DataSuccessOperationType } from 'src/utils/utility/constants/utility.constants';

@Injectable()
export class CardsService {
  constructor(
    private readonly cardsRepository: CardsRepository,
    private readonly utilityService: UtilityService,
  ) {}

  async create(createCardDto: CreateCardDto, createdBy: string) {
    try {
      const { cardNumber } = createCardDto;
      const card = await this.findOne({ where: { cardNumber } });
      if (card) {
        throw new ConflictException(CARD_ERRORS.CARD_ALREADY_EXISTS);
      }
      return await this.cardsRepository.create({ ...createCardDto, createdBy });
    } catch (error) {
      throw error;
    }
  }

  async findOne(findOptions: FindOneOptions<CardsEntity>) {
    try {
      return await this.cardsRepository.findOne(findOptions);
    } catch (error) {
      throw error;
    }
  }

  async findAll(findOptions: FindManyOptions<CardsEntity>) {
    try {
      return await this.cardsRepository.findAll(findOptions);
    } catch (error) {
      throw error;
    }
  }

  async findOneOrFail(findOptions: FindOneOptions<CardsEntity>) {
    try {
      const card = await this.cardsRepository.findOne(findOptions);
      if (!card) {
        throw new NotFoundException(CARD_ERRORS.CARD_NOT_FOUND);
      }
      return card;
    } catch (error) {
      throw error;
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<CardsEntity>,
    updateData: Partial<CardsEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      const card = await this.findOneOrFail({ where: identifierConditions });
      if (card.cardNumber === updateData.cardNumber) {
        throw new ConflictException(CARD_ERRORS.CARD_ALREADY_EXISTS);
      }
      await this.cardsRepository.update(identifierConditions, updateData, entityManager);
      return this.utilityService.getSuccessMessage(
        CardsEntityFields.CARD_NUMBER,
        DataSuccessOperationType.UPDATE,
      );
    } catch (error) {
      throw error;
    }
  }

  async delete(
    identifierConditions: FindOptionsWhere<CardsEntity>,
    deletedBy: string,
    entityManager?: EntityManager,
  ) {
    try {
      await this.findOneOrFail({ where: identifierConditions });
      await this.cardsRepository.delete({ ...identifierConditions, deletedBy }, entityManager);
      return this.utilityService.getSuccessMessage(
        CardsEntityFields.CARD_NUMBER,
        DataSuccessOperationType.DELETE,
      );
    } catch (error) {
      throw error;
    }
  }
}
