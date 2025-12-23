import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateVehicleDto, UpdateVehicleDto, VehicleActionDto, VehicleQueryDto } from './dto';
import { VehicleMastersRepository } from './vehicle-masters.repository';
import { VehicleMasterEntity } from './entities/vehicle-master.entity';
import { DataSource, EntityManager, FindOneOptions, FindOptionsWhere } from 'typeorm';
import {
  VEHICLE_MASTERS_ERRORS,
  VehicleMasterEntityFields,
  VehicleEventTypes,
  VehicleStatus,
  VehicleFileTypes,
  DocumentStatus,
  ServiceDueStatus,
  DEFAULT_EXPIRING_SOON_DAYS,
} from './constants/vehicle-masters.constants';
import { UtilityService } from 'src/utils/utility/utility.service';
import { DataSuccessOperationType } from 'src/utils/utility/constants/utility.constants';
import { InjectDataSource } from '@nestjs/typeorm';
import { VehicleFilesService } from '../vehicle-files/vehicle-files.service';
import { VehicleEventsService } from '../vehicle-events/vehicle-events.service';
import { VehicleVersionsService } from '../vehicle-versions/vehicle-versions.service';
import { ConfigurationService } from '../configurations/configuration.service';
import {
  CONFIGURATION_KEYS,
  CONFIGURATION_MODULES,
} from 'src/utils/master-constants/master-constants';
import { getVehicleQuery } from './queries/get-vehicle.query';

const DEFAULT_SERVICE_INTERVAL_KM = 10000;
const DEFAULT_SERVICE_WARNING_KM = 1000;

@Injectable()
export class VehicleMastersService {
  constructor(
    private readonly vehicleMastersRepository: VehicleMastersRepository,
    private readonly vehicleFilesService: VehicleFilesService,
    private readonly vehicleEventsService: VehicleEventsService,
    private readonly vehicleVersionsService: VehicleVersionsService,
    private readonly configurationService: ConfigurationService,
    private readonly utilityService: UtilityService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  private async getServiceIntervalKm(): Promise<number> {
    try {
      const config = await this.configurationService.findOne({
        where: {
          key: CONFIGURATION_KEYS.VEHICLE_SERVICE_INTERVAL_KM,
          module: CONFIGURATION_MODULES.VEHICLE,
        },
        relations: ['configSettings'],
      });

      if (config?.configSettings?.length > 0) {
        const activeSetting = config.configSettings.find((s) => s.isActive);
        if (activeSetting?.value) {
          return parseInt(activeSetting.value, 10);
        }
      }
    } catch (error) {
      Logger.error('Error fetching service interval km:', error.message);
    }
    return DEFAULT_SERVICE_INTERVAL_KM;
  }

  private async getServiceWarningKm(): Promise<number> {
    try {
      const config = await this.configurationService.findOne({
        where: {
          key: CONFIGURATION_KEYS.VEHICLE_SERVICE_WARNING_KM,
          module: CONFIGURATION_MODULES.VEHICLE,
        },
        relations: ['configSettings'],
      });

      if (config?.configSettings?.length > 0) {
        const activeSetting = config.configSettings.find((s) => s.isActive);
        if (activeSetting?.value) {
          return parseInt(activeSetting.value, 10);
        }
      }
    } catch (error) {
      Logger.error('Error fetching service warning km:', error.message);
    }
    return DEFAULT_SERVICE_WARNING_KM;
  }

  getServiceDueStatus(
    lastServiceKm: number | null,
    currentOdometerKm: number | null,
    serviceIntervalKm: number,
    warningThresholdKm: number,
  ): {
    serviceDueStatus: ServiceDueStatus;
    nextServiceDueKm: number | null;
    kmToNextService: number | null;
    kmSinceLastService: number | null;
  } {
    if (!lastServiceKm) {
      return {
        serviceDueStatus: ServiceDueStatus.OK,
        nextServiceDueKm: null,
        kmToNextService: null,
        kmSinceLastService: null,
      };
    }

    const nextServiceDueKm = lastServiceKm + serviceIntervalKm;
    const kmSinceLastService = currentOdometerKm ? currentOdometerKm - lastServiceKm : null;
    const kmToNextService = currentOdometerKm ? nextServiceDueKm - currentOdometerKm : null;

    let serviceDueStatus: ServiceDueStatus = ServiceDueStatus.OK;
    if (currentOdometerKm && kmToNextService !== null) {
      if (kmToNextService <= 0) {
        serviceDueStatus = ServiceDueStatus.OVERDUE;
      } else if (kmToNextService <= warningThresholdKm) {
        serviceDueStatus = ServiceDueStatus.DUE_SOON;
      }
    }

    return {
      serviceDueStatus,
      nextServiceDueKm,
      kmToNextService,
      kmSinceLastService,
    };
  }

  getDocumentStatus(
    startDate: Date | string | null | undefined,
    endDate: Date | string | null | undefined,
    expiringSoonDays: number = DEFAULT_EXPIRING_SOON_DAYS,
  ): DocumentStatus {
    if (!endDate) {
      return DocumentStatus.NOT_APPLICABLE;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    if (end < today) {
      return DocumentStatus.EXPIRED;
    }

    const expiringSoonDate = new Date(today);
    expiringSoonDate.setDate(expiringSoonDate.getDate() + expiringSoonDays);

    if (end <= expiringSoonDate) {
      return DocumentStatus.EXPIRING_SOON;
    }

    return DocumentStatus.ACTIVE;
  }

  private validateDates(dto: CreateVehicleDto | UpdateVehicleDto): void {
    const dateRanges = [
      { start: dto.insuranceStartDate, end: dto.insuranceEndDate, name: 'Insurance' },
      { start: dto.pucStartDate, end: dto.pucEndDate, name: 'PUC' },
      { start: dto.fitnessStartDate, end: dto.fitnessEndDate, name: 'Fitness' },
    ];

    for (const range of dateRanges) {
      if (range.start && range.end) {
        const start = new Date(range.start);
        const end = new Date(range.end);
        if (end < start) {
          throw new BadRequestException(
            `${range.name}: ${VEHICLE_MASTERS_ERRORS.INVALID_DATE_RANGE}`,
          );
        }
      }
    }
  }

  async create(createVehicleDto: CreateVehicleDto & { createdBy: string }, vehicleFiles: string[]) {
    try {
      const { registrationNo, createdBy } = createVehicleDto;

      // Validate dates
      this.validateDates(createVehicleDto);

      const vehicle = await this.findOne({ where: { registrationNo } });
      if (vehicle) {
        throw new ConflictException(VEHICLE_MASTERS_ERRORS.VEHICLE_ALREADY_EXISTS);
      }

      return await this.dataSource.transaction(async (entityManager) => {
        const vehicleMaster = await this.vehicleMastersRepository.create(
          { ...createVehicleDto, createdBy },
          entityManager,
        );

        await this.vehicleVersionsService.create(
          {
            vehicleMasterId: vehicleMaster.id,
            number: registrationNo,
            brand: createVehicleDto.brand,
            model: createVehicleDto.model,
            mileage: createVehicleDto.mileage,
            fuelType: createVehicleDto.fuelType,
            purchaseDate: createVehicleDto.purchaseDate,
            dealerName: createVehicleDto.dealerName,
            insuranceStartDate: createVehicleDto.insuranceStartDate,
            insuranceEndDate: createVehicleDto.insuranceEndDate,
            pucStartDate: createVehicleDto.pucStartDate,
            pucEndDate: createVehicleDto.pucEndDate,
            fitnessStartDate: createVehicleDto.fitnessStartDate,
            fitnessEndDate: createVehicleDto.fitnessEndDate,
            status: createVehicleDto.status || VehicleStatus.AVAILABLE,
            assignedTo: createVehicleDto.assignedTo,
            remarks: createVehicleDto.remarks,
            additionalData: createVehicleDto.additionalData,
            createdBy,
          },
          entityManager,
        );

        const vehicleAddedEvent = await this.vehicleEventsService.create(
          {
            vehicleMasterId: vehicleMaster.id,
            eventType: VehicleEventTypes.VEHICLE_ADDED,
            createdBy,
          },
          entityManager,
        );

        await this.vehicleEventsService.create(
          {
            vehicleMasterId: vehicleMaster.id,
            eventType: VehicleEventTypes.AVAILABLE,
            createdBy,
          },
          entityManager,
        );

        if (vehicleFiles && vehicleFiles.length > 0) {
          await this.vehicleFilesService.create(
            {
              vehicleMasterId: vehicleMaster.id,
              fileType: VehicleFileTypes.VEHICLE_IMAGE,
              fileKeys: vehicleFiles,
              vehicleEventsId: vehicleAddedEvent.id,
              createdBy,
            },
            entityManager,
          );
        }

        return vehicleMaster;
      });
    } catch (error) {
      throw error;
    }
  }

  async action(
    vehicleActionDto: VehicleActionDto & { fromUserId: string },
    vehicleFiles: string[],
    createdBy: string,
  ) {
    try {
      return await this.vehicleEventsService.action(
        { ...vehicleActionDto, vehicleMasterId: vehicleActionDto.vehicleId },
        vehicleFiles,
        createdBy,
      );
    } catch (error) {
      throw error;
    }
  }

  async findOne(findOptions: FindOneOptions<VehicleMasterEntity>) {
    try {
      return await this.vehicleMastersRepository.findOne(findOptions);
    } catch (error) {
      throw error;
    }
  }

  async findAll(findOptions: VehicleQueryDto) {
    try {
      const { dataQuery, countQuery, params } = await getVehicleQuery(findOptions);
      const [vehicles, total] = await Promise.all([
        this.vehicleMastersRepository.executeRawQuery(dataQuery, params) as Promise<any[]>,
        this.vehicleMastersRepository.executeRawQuery(countQuery, params) as Promise<{
          total: number;
        }>,
      ]);

      // Fetch config values for service due calculation
      const serviceIntervalKm = await this.getServiceIntervalKm();
      const serviceWarningKm = await this.getServiceWarningKm();

      // Add computed statuses to each vehicle
      const vehiclesWithComputedStatus = vehicles.map((vehicle) => {
        const serviceStatus = this.getServiceDueStatus(
          vehicle.lastServiceKm,
          vehicle.currentOdometerKm,
          serviceIntervalKm,
          serviceWarningKm,
        );

        return {
          ...vehicle,
          insuranceStatus: this.getDocumentStatus(
            vehicle.insuranceStartDate,
            vehicle.insuranceEndDate,
          ),
          pucStatus: this.getDocumentStatus(vehicle.pucStartDate, vehicle.pucEndDate),
          fitnessStatus: this.getDocumentStatus(vehicle.fitnessStartDate, vehicle.fitnessEndDate),
          ...serviceStatus,
        };
      });

      // Filter by serviceDueStatus if provided
      let filteredVehicles = vehiclesWithComputedStatus;
      if (findOptions.serviceDueStatus) {
        filteredVehicles = vehiclesWithComputedStatus.filter(
          (v) => v.serviceDueStatus === findOptions.serviceDueStatus,
        );
      }

      return this.utilityService.listResponse(
        filteredVehicles,
        findOptions.serviceDueStatus ? filteredVehicles.length : total[0].total,
      );
    } catch (error) {
      throw error;
    }
  }

  async findOneOrFail(findOptions: FindOneOptions<VehicleMasterEntity>) {
    try {
      const vehicle = await this.vehicleMastersRepository.findOne(findOptions);
      if (!vehicle) {
        throw new NotFoundException(VEHICLE_MASTERS_ERRORS.VEHICLE_NOT_FOUND);
      }
      return vehicle;
    } catch (error) {
      throw error;
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<VehicleMasterEntity>,
    updateData: UpdateVehicleDto & { updatedBy: string },
    entityManager?: EntityManager,
  ) {
    try {
      const vehicle = await this.findOneOrFail({ where: identifierConditions });

      // Validate dates
      this.validateDates(updateData);

      // Get current active version
      const currentVersion = await this.vehicleVersionsService.findOne({
        where: { vehicleMasterId: vehicle.id, isActive: true },
      });

      return await this.dataSource.transaction(async (txManager) => {
        const manager = entityManager || txManager;

        // Deactivate current version
        if (currentVersion) {
          await this.vehicleVersionsService.update(
            { id: currentVersion.id },
            { isActive: false, updatedBy: updateData.updatedBy },
            manager,
          );
        }

        // Helper to convert Date to string
        const toDateString = (date: Date | string | null | undefined): string | undefined => {
          if (!date) return undefined;
          if (date instanceof Date) return date.toISOString().split('T')[0];
          return date;
        };

        // Create new version with merged data
        await this.vehicleVersionsService.create(
          {
            vehicleMasterId: vehicle.id,
            number: updateData.number || currentVersion?.number || vehicle.registrationNo,
            brand: updateData.brand || currentVersion?.brand || '',
            model: updateData.model || currentVersion?.model || '',
            mileage: updateData.mileage || currentVersion?.mileage || '',
            fuelType: updateData.fuelType || currentVersion?.fuelType,
            purchaseDate:
              toDateString(updateData.purchaseDate) || toDateString(currentVersion?.purchaseDate),
            dealerName: updateData.dealerName || currentVersion?.dealerName,
            insuranceStartDate:
              toDateString(updateData.insuranceStartDate) ||
              toDateString(currentVersion?.insuranceStartDate),
            insuranceEndDate:
              toDateString(updateData.insuranceEndDate) ||
              toDateString(currentVersion?.insuranceEndDate),
            pucStartDate:
              toDateString(updateData.pucStartDate) || toDateString(currentVersion?.pucStartDate),
            pucEndDate:
              toDateString(updateData.pucEndDate) || toDateString(currentVersion?.pucEndDate),
            fitnessStartDate:
              toDateString(updateData.fitnessStartDate) ||
              toDateString(currentVersion?.fitnessStartDate),
            fitnessEndDate:
              toDateString(updateData.fitnessEndDate) ||
              toDateString(currentVersion?.fitnessEndDate),
            status: (updateData.status ||
              currentVersion?.status ||
              VehicleStatus.AVAILABLE) as VehicleStatus,
            assignedTo: updateData.assignedTo || currentVersion?.assignedTo,
            remarks:
              updateData.remarks !== undefined ? updateData.remarks : currentVersion?.remarks,
            additionalData: updateData.additionalData || currentVersion?.additionalData,
            createdBy: updateData.updatedBy,
          },
          manager,
        );

        // Create update event
        await this.vehicleEventsService.create(
          {
            vehicleMasterId: vehicle.id,
            eventType: VehicleEventTypes.UPDATED,
            createdBy: updateData.updatedBy,
          },
          manager,
        );

        return vehicle;
      });
    } catch (error) {
      throw error;
    }
  }

  //Created seperate method because we need to return the vehicle with the active version and the computed statuses
  async findById(id: string) {
    try {
      const vehicle = await this.findOneOrFail({ where: { id } });

      // Get active version
      const activeVersion = await this.vehicleVersionsService.findOne({
        where: { vehicleMasterId: id, isActive: true },
      });

      if (!activeVersion) {
        return vehicle;
      }

      // Add computed statuses
      return {
        ...vehicle,
        currentVersion: {
          ...activeVersion,
          insuranceStatus: this.getDocumentStatus(
            activeVersion.insuranceStartDate,
            activeVersion.insuranceEndDate,
          ),
          pucStatus: this.getDocumentStatus(activeVersion.pucStartDate, activeVersion.pucEndDate),
          fitnessStatus: this.getDocumentStatus(
            activeVersion.fitnessStartDate,
            activeVersion.fitnessEndDate,
          ),
        },
      };
    } catch (error) {
      throw error;
    }
  }

  async delete(
    identifierConditions: FindOptionsWhere<VehicleMasterEntity>,
    deletedBy: string,
    entityManager?: EntityManager,
  ) {
    try {
      await this.findOneOrFail({ where: identifierConditions });
      await this.vehicleMastersRepository.delete(
        { ...identifierConditions, deletedBy },
        entityManager,
      );
      return this.utilityService.getSuccessMessage(
        VehicleMasterEntityFields.VEHICLE,
        DataSuccessOperationType.DELETE,
      );
    } catch (error) {
      throw error;
    }
  }
}
