import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindOneOptions, FindOptionsWhere } from 'typeorm';
import { VehicleServicesRepository } from './vehicle-services.repository';
import { VehicleServiceEntity } from './entities/vehicle-service.entity';
import {
  CreateVehicleServiceDto,
  UpdateVehicleServiceDto,
  VehicleServiceQueryDto,
  ServiceAnalyticsQueryDto,
} from './dto';
import {
  VEHICLE_SERVICES_ERRORS,
  VEHICLE_SERVICES_SUCCESS,
  SERVICE_TYPES_RESET_INTERVAL,
  VehicleServiceType,
  VehicleServiceStatus,
  VehicleServiceFileType,
} from './constants/vehicle-services.constants';
import { UtilityService } from 'src/utils/utility/utility.service';
import { VehicleMastersService } from '../vehicle-masters/vehicle-masters.service';
import { VehicleVersionsService } from '../vehicle-versions/vehicle-versions.service';
import { VehicleServiceFilesService } from '../vehicle-service-files/vehicle-service-files.service';
import { ConfigurationService } from '../configurations/configuration.service';
import {
  CONFIGURATION_KEYS,
  CONFIGURATION_MODULES,
} from 'src/utils/master-constants/master-constants';
import {
  buildVehicleServiceListQuery,
  buildServiceAnalyticsQuery,
} from './queries/vehicle-services.queries';
import { DateTimeService } from 'src/utils/datetime';

@Injectable()
export class VehicleServicesService {
  constructor(
    private readonly vehicleServicesRepository: VehicleServicesRepository,
    private readonly vehicleMastersService: VehicleMastersService,
    private readonly vehicleVersionsService: VehicleVersionsService,
    private readonly vehicleServiceFilesService: VehicleServiceFilesService,
    private readonly configurationService: ConfigurationService,
    private readonly utilityService: UtilityService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly dateTimeService: DateTimeService,
  ) {}

  private async shouldResetInterval(serviceType: string): Promise<boolean> {
    try {
      const config = await this.configurationService.findOne({
        where: {
          key: CONFIGURATION_KEYS.VEHICLE_SERVICE_TYPES,
          module: CONFIGURATION_MODULES.VEHICLE,
        },
        relations: ['configSettings'],
      });

      if (config?.configSettings?.length > 0) {
        const activeSetting = config.configSettings.find((s) => s.isActive);
        if (activeSetting?.value && Array.isArray(activeSetting.value)) {
          const serviceTypeConfig = activeSetting.value.find(
            (item: any) => item.value === serviceType,
          );
          if (serviceTypeConfig) {
            return serviceTypeConfig.resetsInterval === true;
          }
        }
      }
    } catch (error) {
      Logger.error('Error fetching service types config:', error.message);
    }
    // Fallback to hardcoded array if DB config fetch fails
    return SERVICE_TYPES_RESET_INTERVAL.includes(serviceType as VehicleServiceType);
  }

  private validateServiceDate(serviceDate: string, timezone?: string): void {
    const serviceDateStr = serviceDate.split('T')[0];
    if (this.dateTimeService.isFutureDate(serviceDateStr, timezone)) {
      throw new BadRequestException(VEHICLE_SERVICES_ERRORS.INVALID_SERVICE_DATE);
    }
  }

  async create(
    createDto: CreateVehicleServiceDto & { createdBy: string },
    serviceFiles?: string[],
    timezone?: string,
  ): Promise<VehicleServiceEntity> {
    const { vehicleMasterId, serviceDate, serviceType, createdBy } = createDto;

    await this.vehicleMastersService.findOneOrFail({ where: { id: vehicleMasterId } });

    this.validateServiceDate(serviceDate, timezone);

    const resetsServiceInterval =
      createDto.resetsServiceInterval ?? (await this.shouldResetInterval(serviceType));

    return await this.dataSource.transaction(async (entityManager) => {
      const service = await this.vehicleServicesRepository.create(
        {
          ...createDto,
          serviceDate: new Date(serviceDate),
          resetsServiceInterval,
          serviceStatus: createDto.serviceStatus || VehicleServiceStatus.PENDING,
          createdBy,
          updatedBy: createdBy,
        },
        entityManager,
      );

      // Save file records (files already uploaded by decorator)
      if (serviceFiles && serviceFiles.length > 0) {
        await this.vehicleServiceFilesService.create(
          {
            vehicleServiceId: service.id,
            fileKeys: serviceFiles,
            fileType: VehicleServiceFileType.INVOICE,
            createdBy,
          },
          entityManager,
        );
      }

      if (createDto.serviceStatus === VehicleServiceStatus.COMPLETED && resetsServiceInterval) {
        await this.updateVehicleLastService(
          vehicleMasterId,
          createDto.odometerReading,
          serviceDate,
          createdBy,
          entityManager,
        );
      }

      return service;
    });
  }

  private async updateVehicleLastService(
    vehicleMasterId: string,
    odometerReading: number,
    serviceDate: string,
    updatedBy: string,
    entityManager: EntityManager,
  ): Promise<void> {
    const activeVersion = await this.vehicleVersionsService.findOne({
      where: { vehicleMasterId, isActive: true },
    });

    if (activeVersion) {
      await this.vehicleVersionsService.update(
        { id: activeVersion.id },
        {
          lastServiceKm: odometerReading,
          lastServiceDate: new Date(serviceDate),
          updatedBy,
        },
        entityManager,
      );
    }
  }

  async findAll(query: VehicleServiceQueryDto) {
    const { dataQuery, countQuery, statsQuery, params } = buildVehicleServiceListQuery(query);

    const [services, countResult, statsResult] = await Promise.all([
      this.vehicleServicesRepository.executeRawQuery(dataQuery, params),
      this.vehicleServicesRepository.executeRawQuery(countQuery, params.slice(0, -2)),
      this.vehicleServicesRepository.executeRawQuery(statsQuery, params.slice(0, -2)),
    ]);

    const stats = statsResult[0] || {};

    return {
      stats: {
        totalServices: stats.totalServices || 0,
        totalCost: parseFloat(stats.totalCost || 0),
        averageCost: parseFloat(stats.averageCost || 0),
        byStatus: {
          pending: stats.pendingCount || 0,
          completed: stats.completedCount || 0,
          cancelled: stats.cancelledCount || 0,
        },
        byServiceType: {
          REGULAR_SERVICE: stats.regularServiceCount || 0,
          EMERGENCY_SERVICE: stats.emergencyServiceCount || 0,
          BREAKDOWN_REPAIR: stats.breakdownRepairCount || 0,
          ACCIDENT_REPAIR: stats.accidentRepairCount || 0,
          TYRE_CHANGE: stats.tyreChangeCount || 0,
          BATTERY_REPLACEMENT: stats.batteryReplacementCount || 0,
          OTHER: stats.otherCount || 0,
        },
      },
      records: services,
      totalRecords: countResult[0]?.total || 0,
    };
  }

  async findOne(
    options: FindOneOptions<VehicleServiceEntity>,
    entityManager?: EntityManager,
  ): Promise<VehicleServiceEntity | null> {
    return await this.vehicleServicesRepository.findOne(options, entityManager);
  }

  async findOneOrFail(
    options: FindOneOptions<VehicleServiceEntity>,
  ): Promise<VehicleServiceEntity> {
    const service = await this.findOne(options);
    if (!service) {
      throw new NotFoundException(VEHICLE_SERVICES_ERRORS.SERVICE_NOT_FOUND);
    }
    return service;
  }

  async update(
    identifierConditions: FindOptionsWhere<VehicleServiceEntity>,
    updateDto: UpdateVehicleServiceDto & { updatedBy: string },
    timezone?: string,
  ): Promise<{ message: string }> {
    const service = await this.findOneOrFail({ where: identifierConditions });

    if (updateDto.serviceDate) {
      this.validateServiceDate(updateDto.serviceDate, timezone);
    }

    const serviceType = updateDto.serviceType || service.serviceType;
    const resetsServiceInterval =
      updateDto.resetsServiceInterval ?? (await this.shouldResetInterval(serviceType));

    return await this.dataSource.transaction(async (entityManager) => {
      await this.vehicleServicesRepository.update(
        identifierConditions,
        {
          ...updateDto,
          serviceDate: updateDto.serviceDate ? new Date(updateDto.serviceDate) : undefined,
          resetsServiceInterval,
          updatedBy: updateDto.updatedBy,
        },
        entityManager,
      );

      const newStatus = updateDto.serviceStatus || service.serviceStatus;
      if (
        newStatus === VehicleServiceStatus.COMPLETED &&
        resetsServiceInterval &&
        service.serviceStatus !== VehicleServiceStatus.COMPLETED
      ) {
        const odometerReading = updateDto.odometerReading || service.odometerReading;
        const serviceDate =
          updateDto.serviceDate || service.serviceDate.toISOString().split('T')[0];
        await this.updateVehicleLastService(
          service.vehicleMasterId,
          odometerReading,
          serviceDate,
          updateDto.updatedBy,
          entityManager,
        );
      }

      return { message: VEHICLE_SERVICES_SUCCESS.SERVICE_UPDATED };
    });
  }

  async delete(
    identifierConditions: FindOptionsWhere<VehicleServiceEntity>,
    deletedBy: string,
  ): Promise<{ message: string }> {
    await this.findOneOrFail({ where: identifierConditions });
    await this.vehicleServicesRepository.delete(identifierConditions, deletedBy);
    return { message: VEHICLE_SERVICES_SUCCESS.SERVICE_DELETED };
  }

  async getServiceAnalytics(query: ServiceAnalyticsQueryDto) {
    const { summaryQuery, costByTypeQuery, monthlyQuery, costPerKmQuery, params } =
      buildServiceAnalyticsQuery(query);

    const [summary, costByType, monthly] = await Promise.all([
      this.vehicleServicesRepository.executeRawQuery(summaryQuery, params),
      this.vehicleServicesRepository.executeRawQuery(costByTypeQuery, params),
      this.vehicleServicesRepository.executeRawQuery(monthlyQuery, params),
    ]);

    let costPerKm = null;
    if (costPerKmQuery) {
      const [result] = await this.vehicleServicesRepository.executeRawQuery(costPerKmQuery, params);
      costPerKm = result?.costPerKm || 0;
    }

    const totalKmDriven =
      summary[0]?.maxOdometer && summary[0]?.minOdometer
        ? summary[0].maxOdometer - summary[0].minOdometer
        : 0;

    return {
      summary: {
        totalServices: summary[0]?.totalServices || 0,
        totalCost: parseFloat(summary[0]?.totalCost || 0),
        averageCost: parseFloat(summary[0]?.averageCost || 0),
        totalKmDriven,
        costPerKm: costPerKm ? parseFloat(costPerKm) : null,
      },
      costByType: costByType.map((item: any) => ({
        serviceType: item.serviceType,
        count: item.count,
        totalCost: parseFloat(item.totalCost),
        averageCost: parseFloat(item.averageCost),
      })),
      monthlyBreakdown: monthly.map((item: any) => ({
        month: item.month,
        serviceCount: item.serviceCount,
        totalCost: parseFloat(item.totalCost),
      })),
    };
  }
}
