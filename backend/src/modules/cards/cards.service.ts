import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateCardDto } from './dto';
import { CardsRepository } from './cards.repository';
import { CardsEntity } from './entities/card.entity';
import { EntityManager, FindManyOptions, FindOneOptions, FindOptionsWhere } from 'typeorm';
import {
  CARD_ERRORS,
  CardExpiryStatus,
  CardsEntityFields,
  DEFAULT_CARD_EXPIRY_WARNING_DAYS,
} from './constants/card.constants';
import { UtilityService } from 'src/utils/utility/utility.service';
import { DataSuccessOperationType } from 'src/utils/utility/constants/utility.constants';
import { ConfigurationService } from '../configurations/configuration.service';
import { ConfigSettingService } from '../config-settings/config-setting.service';
import {
  CONFIGURATION_KEYS,
  CONFIGURATION_MODULES,
} from 'src/utils/master-constants/master-constants';

@Injectable()
export class CardsService {
  private readonly logger = new Logger(CardsService.name);

  constructor(
    private readonly cardsRepository: CardsRepository,
    private readonly utilityService: UtilityService,
    private readonly configurationService: ConfigurationService,
    private readonly configSettingService: ConfigSettingService,
  ) {}

  /**
   * Get card expiry warning days from configuration
   */
  private async getExpiryWarningDays(): Promise<number> {
    try {
      const configuration = await this.configurationService.findOne({
        where: {
          key: CONFIGURATION_KEYS.CARD_EXPIRY_WARNING_DAYS,
          module: CONFIGURATION_MODULES.CARD,
        },
      });

      if (!configuration) {
        this.logger.warn('Card expiry warning days config not found, using default');
        return DEFAULT_CARD_EXPIRY_WARNING_DAYS;
      }

      const configSetting = await this.configSettingService.findOne({
        where: { configId: configuration.id, isActive: true },
      });

      if (!configSetting?.value) {
        this.logger.warn('Card expiry warning days setting not found, using default');
        return DEFAULT_CARD_EXPIRY_WARNING_DAYS;
      }

      return Number(configSetting.value);
    } catch {
      this.logger.warn('Error fetching card expiry warning days, using default');
      return DEFAULT_CARD_EXPIRY_WARNING_DAYS;
    }
  }

  async calculateExpiryStatus(expiryDate: string): Promise<CardExpiryStatus> {
    const warningDays = await this.getExpiryWarningDays();

    const [month, year] = expiryDate.split('/').map(Number);
    const expiryDateObj = new Date(year, month - 1, 1); // First day of expiry month
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const warningDate = new Date(today);
    warningDate.setDate(warningDate.getDate() + warningDays);

    if (expiryDateObj < today) {
      return CardExpiryStatus.EXPIRED;
    } else if (expiryDateObj <= warningDate) {
      return CardExpiryStatus.EXPIRING_SOON;
    }
    return CardExpiryStatus.VALID;
  }

  async create(createCardDto: CreateCardDto, createdBy: string) {
    try {
      const { cardNumber, expiryDate } = createCardDto;
      const card = await this.findOne({ where: { cardNumber } });
      if (card) {
        throw new ConflictException(CARD_ERRORS.CARD_ALREADY_EXISTS);
      }

      let expiryStatus: CardExpiryStatus | undefined;
      if (expiryDate) {
        expiryStatus = await this.calculateExpiryStatus(expiryDate);
      }

      await this.cardsRepository.create({ ...createCardDto, expiryStatus, createdBy });
      return this.utilityService.getSuccessMessage(
        CardsEntityFields.CARD_NUMBER,
        DataSuccessOperationType.CREATE,
      );
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
      if (updateData.cardNumber && card.cardNumber !== updateData.cardNumber) {
        const existingCard = await this.findOne({ where: { cardNumber: updateData.cardNumber } });
        if (existingCard) {
          throw new ConflictException(CARD_ERRORS.CARD_ALREADY_EXISTS);
        }
      }
      // Recalculate expiry status if expiryDate is being updated
      if (updateData.expiryDate) {
        updateData.expiryStatus = await this.calculateExpiryStatus(updateData.expiryDate);
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

  private calculateExpiryStatusSync(expiryDate: string, warningDays: number): CardExpiryStatus {
    const [month, year] = expiryDate.split('/').map(Number);
    const expiryDateObj = new Date(year, month - 1, 1);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const warningDate = new Date(today);
    warningDate.setDate(warningDate.getDate() + warningDays);

    if (expiryDateObj < today) {
      return CardExpiryStatus.EXPIRED;
    } else if (expiryDateObj <= warningDate) {
      return CardExpiryStatus.EXPIRING_SOON;
    }
    return CardExpiryStatus.VALID;
  }

  /**
   * Update expiry status for all cards (called by cron job)
   * Returns count of updated cards
   */
  async updateAllExpiryStatuses(): Promise<{
    updated: number;
    expiringSoon: number;
    expired: number;
  }> {
    const warningDays = await this.getExpiryWarningDays();
    const { records: cards } = await this.findAll({});
    let updated = 0;
    let expiringSoon = 0;
    let expired = 0;

    for (const card of cards) {
      const newStatus = this.calculateExpiryStatusSync(card.expiryDate, warningDays);

      if (newStatus === CardExpiryStatus.EXPIRING_SOON) expiringSoon++;
      if (newStatus === CardExpiryStatus.EXPIRED) expired++;

      if (card.expiryStatus !== newStatus) {
        await this.cardsRepository.update({ id: card.id }, { expiryStatus: newStatus });
        updated++;
      }
    }

    return { updated, expiringSoon, expired };
  }

  /**
   * Get cards that are expiring soon or expired (for alerts)
   */
  async getExpiringCards(): Promise<{ expiringSoon: CardsEntity[]; expired: CardsEntity[] }> {
    const { records: cards } = await this.findAll({});

    const expiringSoon = cards.filter(
      (card) => card.expiryStatus === CardExpiryStatus.EXPIRING_SOON,
    );
    const expired = cards.filter((card) => card.expiryStatus === CardExpiryStatus.EXPIRED);

    return { expiringSoon, expired };
  }
}
