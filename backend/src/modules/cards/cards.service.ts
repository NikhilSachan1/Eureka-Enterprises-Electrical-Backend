import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { CreateCardDto, BulkDeleteCardDto, CardActionDto, CardsQueryDto } from './dto';
import { CardsRepository } from './cards.repository';
import { CardsEntity } from './entities/card.entity';
import { EntityManager, FindManyOptions, FindOneOptions, FindOptionsWhere } from 'typeorm';
import {
  CARD_ERRORS,
  CARD_SUCCESS_MESSAGES,
  CardExpiryStatus,
  CardsEntityFields,
  DEFAULT_CARD_EXPIRY_WARNING_DAYS,
  CardActionType,
} from './constants/card.constants';
import { UtilityService } from 'src/utils/utility/utility.service';
import { DataSuccessOperationType } from 'src/utils/utility/constants/utility.constants';
import { ConfigurationService } from '../configurations/configuration.service';
import { ConfigSettingService } from '../config-settings/config-setting.service';
import { FuelExpenseService } from '../fuel-expense/fuel-expense.service';
import { VehicleMastersService } from '../vehicle-masters/vehicle-masters.service';
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
    @Inject(forwardRef(() => FuelExpenseService))
    private readonly fuelExpenseService: FuelExpenseService,
    @Inject(forwardRef(() => VehicleMastersService))
    private readonly vehicleMastersService: VehicleMastersService,
  ) {}

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

  async action(actionDto: CardActionDto, updatedBy: string): Promise<{ message: string }> {
    const { cardId, action, vehicleMasterId } = actionDto;

    await this.findOneOrFail({ where: { id: cardId } });

    switch (action) {
      case CardActionType.ASSIGN: {
        if (!vehicleMasterId) {
          throw new BadRequestException(CARD_ERRORS.VEHICLE_ID_REQUIRED);
        }

        const vehicle = await this.vehicleMastersService.findOneOrFail({
          where: { id: vehicleMasterId },
        });

        if (vehicle.cardId && vehicle.cardId !== cardId) {
          throw new ConflictException(CARD_ERRORS.VEHICLE_ALREADY_HAS_CARD);
        }

        const vehicleWithCard = await this.vehicleMastersService.findOne({
          where: { cardId, deletedAt: null },
        });
        if (vehicleWithCard && vehicleWithCard.id !== vehicleMasterId) {
          throw new ConflictException(CARD_ERRORS.CARD_ALREADY_ASSIGNED);
        }

        await this.vehicleMastersService.updateMaster(
          { id: vehicleMasterId },
          { cardId, updatedBy },
        );
        return { message: CARD_SUCCESS_MESSAGES.CARD_ASSIGNED };
      }

      case CardActionType.UNASSIGN: {
        const vehicle = await this.vehicleMastersService.findOne({
          where: { cardId, deletedAt: null },
        });

        if (!vehicle) {
          throw new BadRequestException(CARD_ERRORS.CARD_NOT_ASSIGNED);
        }

        await this.vehicleMastersService.updateMaster(
          { id: vehicle.id },
          { cardId: null, updatedBy },
        );
        return { message: CARD_SUCCESS_MESSAGES.CARD_UNASSIGNED };
      }

      default:
        throw new BadRequestException(CARD_ERRORS.INVALID_ACTION);
    }
  }

  async findByVehicleId(vehicleMasterId: string): Promise<CardsEntity | null> {
    const vehicle = await this.vehicleMastersService.findOne({
      where: { id: vehicleMasterId, deletedAt: null },
    });
    if (!vehicle?.cardId) {
      return null;
    }
    return this.findOne({ where: { id: vehicle.cardId, deletedAt: null } });
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

  async findAllWithStats(query: CardsQueryDto) {
    try {
      const { isAllocated, search, ...filterOptions } = query;

      const whereConditions: FindOptionsWhere<CardsEntity> = {
        deletedAt: null,
      };

      if (filterOptions.cardNumber) whereConditions.cardNumber = filterOptions.cardNumber;
      if (filterOptions.cardType) whereConditions.cardType = filterOptions.cardType;
      if (filterOptions.cardName) whereConditions.cardName = filterOptions.cardName;
      if (filterOptions.expiryDate) whereConditions.expiryDate = filterOptions.expiryDate;
      if (filterOptions.holderName) whereConditions.holderName = filterOptions.holderName;

      const cardsResult = await this.cardsRepository.findAll({ where: whereConditions });

      const vehiclesWithCards = await this.vehicleMastersService.findAllRaw({
        select: ['id', 'registrationNo', 'cardId'],
        where: { deletedAt: null },
      });

      const cardToVehicleMap = new Map<
        string,
        { id: string; registrationNo: string; brand?: string; model?: string }
      >();

      for (const vehicle of vehiclesWithCards) {
        if (vehicle.cardId) {
          cardToVehicleMap.set(vehicle.cardId, {
            id: vehicle.id,
            registrationNo: vehicle.registrationNo,
            brand: (vehicle as any).brand,
            model: (vehicle as any).model,
          });
        }
      }

      let enrichedCards = cardsResult.records.map((card) => {
        const vehicle = cardToVehicleMap.get(card.id);
        return {
          ...card,
          isAllocated: !!vehicle,
          allocatedVehicle: vehicle || null,
        };
      });

      if (isAllocated !== undefined) {
        enrichedCards = enrichedCards.filter((card) => card.isAllocated === isAllocated);
      }

      if (search) {
        const searchLower = search.toLowerCase();
        enrichedCards = enrichedCards.filter(
          (card) =>
            card.cardNumber?.toLowerCase().includes(searchLower) ||
            card.cardType?.toLowerCase().includes(searchLower) ||
            card.cardName?.toLowerCase().includes(searchLower) ||
            card.holderName?.toLowerCase().includes(searchLower),
        );
      }

      const total = cardsResult.records.length;
      const allocated = cardsResult.records.filter((card) => cardToVehicleMap.has(card.id)).length;
      const available = total - allocated;

      const byExpiryStatus: Record<string, number> = {};
      Object.values(CardExpiryStatus).forEach((status) => {
        byExpiryStatus[status] = cardsResult.records.filter(
          (card) => card.expiryStatus === status,
        ).length;
      });

      const byCardType: Record<string, number> = {};
      cardsResult.records.forEach((card) => {
        if (card.cardType) {
          byCardType[card.cardType] = (byCardType[card.cardType] || 0) + 1;
        }
      });

      const byCardName: Record<string, number> = {};
      cardsResult.records.forEach((card) => {
        if (card.cardName) {
          byCardName[card.cardName] = (byCardName[card.cardName] || 0) + 1;
        }
      });

      return {
        stats: {
          total,
          allocated,
          available,
          byExpiryStatus,
          byCardType,
          byCardName,
        },
        records: enrichedCards,
        totalRecords: enrichedCards.length,
      };
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
        CardsEntityFields.CARD,
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

  async getExpiringCards(): Promise<{ expiringSoon: CardsEntity[]; expired: CardsEntity[] }> {
    const { records: cards } = await this.findAll({});

    const expiringSoon = cards.filter(
      (card) => card.expiryStatus === CardExpiryStatus.EXPIRING_SOON,
    );
    const expired = cards.filter((card) => card.expiryStatus === CardExpiryStatus.EXPIRED);

    return { expiringSoon, expired };
  }

  async bulkDeleteCards(bulkDeleteDto: BulkDeleteCardDto) {
    const { cardIds, deletedBy } = bulkDeleteDto;
    const result = [];
    const errors = [];

    for (const cardId of cardIds) {
      try {
        const card = await this.findOne({ where: { id: cardId } });

        if (!card) {
          throw new NotFoundException(CARD_ERRORS.CARD_NOT_FOUND);
        }

        // Check if card is associated with any fuel expense
        await this.validateCardNotInUse(cardId);

        await this.cardsRepository.delete({ id: cardId, deletedBy });
        result.push({ id: cardId });
      } catch (error) {
        errors.push({
          cardId,
          error: error.message,
        });
      }
    }

    return {
      message: CARD_SUCCESS_MESSAGES.CARD_DELETE_PROCESSED.replace(
        '{length}',
        cardIds.length.toString(),
      )
        .replace('{success}', result.length.toString())
        .replace('{error}', errors.length.toString()),
      result,
      errors,
    };
  }

  private async validateCardNotInUse(cardId: string): Promise<void> {
    const fuelExpense = await this.fuelExpenseService.findOne({
      where: { cardId, deletedAt: null },
    });

    if (fuelExpense) {
      throw new BadRequestException(CARD_ERRORS.CARD_HAS_FUEL_EXPENSES);
    }
  }
}
