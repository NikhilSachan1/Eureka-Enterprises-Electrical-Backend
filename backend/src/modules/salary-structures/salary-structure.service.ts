import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { SalaryStructureRepository } from './salary-structure.repository';
import { SalaryChangeLogRepository } from '../salary-change-logs/salary-change-log.repository';
import {
  CreateSalaryStructureDto,
  UpdateSalaryStructureDto,
  ApplyIncrementDto,
  GetSalaryStructureDto,
} from './dto';
import { SalaryStructureEntity } from './entities/salary-structure.entity';
import { SalaryChangeType } from '../salary-change-logs/constants/salary-change-log.constants';
import {
  SALARY_STRUCTURE_ERRORS,
  IncrementType,
  SALARY_FIELD_NAMES,
} from './constants/salary-structure.constants';
import { buildSalaryHistoryQuery } from './queries/salary-structure.queries';
import { IsNull, LessThanOrEqual } from 'typeorm';
import { DataSuccessOperationType, SortOrder } from 'src/utils/utility/constants/utility.constants';
import { ConfigurationService } from '../configurations/configuration.service';
import { ConfigSettingService } from '../config-settings/config-setting.service';
import {
  CONFIGURATION_KEYS,
  CONFIGURATION_MODULES,
} from 'src/utils/master-constants/master-constants';
import { DateTimeService } from 'src/utils/datetime';
import { UtilityService } from 'src/utils/utility/utility.service';

@Injectable()
export class SalaryStructureService {
  constructor(
    private readonly salaryStructureRepository: SalaryStructureRepository,
    private readonly salaryChangeLogRepository: SalaryChangeLogRepository,
    private readonly configurationService: ConfigurationService,
    private readonly configSettingService: ConfigSettingService,
    @InjectDataSource() private dataSource: DataSource,
    private readonly dateTimeService: DateTimeService,
    private readonly utilityService: UtilityService,
  ) {}

  async create(
    createDto: CreateSalaryStructureDto,
    createdBy: string,
    entityManager?: EntityManager,
  ): Promise<SalaryStructureEntity> {
    // Validate ESIC
    await this.validateEsic(createDto);

    // Check if active salary structure already exists
    const existingActive = await this.getActiveByUserId(createDto.userId);
    if (existingActive) {
      throw new BadRequestException(SALARY_STRUCTURE_ERRORS.ALREADY_EXISTS);
    }

    const runInTransaction = async (manager: EntityManager) => {
      // Create salary structure
      const salaryStructure = await this.salaryStructureRepository.create(
        {
          ...createDto,
          effectiveFrom: new Date(createDto.effectiveFrom),
          incrementType: IncrementType.INITIAL,
          createdBy,
        },
        manager,
      );

      // Log the creation
      await this.salaryChangeLogRepository.create(
        {
          salaryStructureId: salaryStructure.id,
          changeType: SalaryChangeType.CREATE,
          newValues: this.getSalarySnapshot(salaryStructure),
          changedBy: createdBy,
          reason: 'Initial salary structure creation',
        },
        manager,
      );

      return salaryStructure;
    };

    if (entityManager) {
      return runInTransaction(entityManager);
    }

    return this.dataSource.transaction(runInTransaction);
  }

  async update(
    id: string,
    updateDto: UpdateSalaryStructureDto,
    updatedBy: string,
  ): Promise<{ message: string } | null> {
    const existing = await this.salaryStructureRepository.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(SALARY_STRUCTURE_ERRORS.NOT_FOUND);
    }

    // Store previous values for audit
    const previousValues = this.getSalarySnapshot(existing);

    // Update and recalculate
    const updatedData = {
      ...updateDto,
      updatedBy,
    };

    // Validate ESIC if updating salary components
    if (this.isSalaryComponentUpdate(updateDto)) {
      const mergedDto = { ...existing, ...updateDto };
      await this.validateEsic(mergedDto as any);
    }

    await this.dataSource.transaction(async (manager) => {
      await this.salaryStructureRepository.update({ id }, updatedData, manager);

      // Fetch updated record
      const updated = await this.salaryStructureRepository.findOne({ where: { id } });

      // Log the update
      await this.salaryChangeLogRepository.create(
        {
          salaryStructureId: id,
          changeType: SalaryChangeType.UPDATE,
          previousValues,
          newValues: this.getSalarySnapshot(updated),
          changedBy: updatedBy,
          reason: updateDto.reason || 'Salary structure update',
        },
        manager,
      );

      return updated;
    });

    return this.utilityService.getSuccessMessage(
      SALARY_FIELD_NAMES.SALARY_STRUCTURE,
      DataSuccessOperationType.UPDATE,
    );
  }

  async applyIncrement(
    incrementDto: ApplyIncrementDto,
    appliedBy: string,
    timezone?: string,
  ): Promise<SalaryStructureEntity> {
    const {
      userId,
      incrementType,
      effectiveFrom,
      remarks,
      incrementPercentage,
      basic,
      hra,
      foodAllowance,
      conveyanceAllowance,
      medicalAllowance,
      specialAllowance,
      employeePf,
      employerPf,
      tds,
      esic,
      professionalTax,
    } = incrementDto;

    // Validate ESIC
    await this.validateEsic({
      basic,
      hra,
      foodAllowance,
      conveyanceAllowance,
      medicalAllowance,
      specialAllowance,
      esic,
    });

    // Validate effective date is not in past (timezone-aware)
    const effectiveDateStr =
      typeof effectiveFrom === 'string'
        ? effectiveFrom.split('T')[0]
        : this.dateTimeService.toDateString(new Date(effectiveFrom));

    if (this.dateTimeService.isPastDate(effectiveDateStr, timezone)) {
      throw new BadRequestException(SALARY_STRUCTURE_ERRORS.EFFECTIVE_FROM_PAST);
    }

    const effectiveDate = new Date(effectiveFrom);

    // Get current active salary structure
    const currentStructure = await this.getActiveByUserId(userId);
    if (!currentStructure) {
      throw new NotFoundException(SALARY_STRUCTURE_ERRORS.NO_ACTIVE_STRUCTURE);
    }

    return this.dataSource.transaction(async (manager) => {
      // Use values directly from DTO - no automatic calculation
      const newSalaryData: Partial<SalaryStructureEntity> = {
        userId,
        basic,
        hra,
        foodAllowance,
        conveyanceAllowance,
        medicalAllowance,
        specialAllowance,
        employeePf,
        employerPf,
        tds,
        esic,
        professionalTax,
        effectiveFrom: effectiveDate,
        incrementPercentage: incrementPercentage || 0,
        incrementType,
        previousStructureId: currentStructure.id,
        remarks,
        createdBy: appliedBy,
      };

      // Deactivate current structure (set effectiveTo)
      const dayBeforeEffective = new Date(effectiveDate);
      dayBeforeEffective.setDate(dayBeforeEffective.getDate() - 1);
      await this.salaryStructureRepository.update(
        { id: currentStructure.id },
        {
          effectiveTo: dayBeforeEffective,
          isActive: false,
          updatedBy: appliedBy,
        },
        manager,
      );

      // Create new salary structure
      const newStructure = await this.salaryStructureRepository.create(newSalaryData, manager);

      // Log the increment
      const incrementInfo = incrementPercentage ? ` (${incrementPercentage}%)` : '';
      await this.salaryChangeLogRepository.create(
        {
          salaryStructureId: newStructure.id,
          changeType: SalaryChangeType.INCREMENT,
          previousValues: this.getSalarySnapshot(currentStructure),
          newValues: this.getSalarySnapshot(newStructure),
          changedBy: appliedBy,
          reason: `${incrementType} increment${incrementInfo}`,
        },
        manager,
      );

      return newStructure;
    });
  }

  async findAll(options: GetSalaryStructureDto) {
    return this.salaryStructureRepository.findAll(options);
  }

  async findOne(id: string): Promise<SalaryStructureEntity> {
    const structure = await this.salaryStructureRepository.findOne({
      where: { id },
      relations: [
        'user',
        'createdByUser',
        'updatedByUser',
        'changeLogs',
        'changeLogs.changedByUser',
      ],
    });
    if (!structure) {
      throw new NotFoundException(SALARY_STRUCTURE_ERRORS.NOT_FOUND);
    }
    return structure;
  }

  async findActiveByUserId(userId: string): Promise<SalaryStructureEntity> {
    const structure = await this.getActiveByUserId(userId);
    if (!structure) {
      throw new NotFoundException(SALARY_STRUCTURE_ERRORS.NO_ACTIVE_STRUCTURE);
    }
    return structure;
  }

  async findEffectiveOnDate(userId: string, date: Date): Promise<SalaryStructureEntity | null> {
    return await this.salaryStructureRepository.findOne({
      where: {
        userId,
        isActive: true,
        effectiveFrom: LessThanOrEqual(date),
      },
      order: { effectiveFrom: SortOrder.DESC },
    });
  }

  async findSalaryHistory(userId: string): Promise<SalaryStructureEntity[]> {
    const { query, params } = buildSalaryHistoryQuery(userId);
    return await this.salaryStructureRepository.executeRawQuery(query, params);
  }

  async getChangeHistory(salaryStructureId: string) {
    return this.salaryChangeLogRepository.getChangeHistoryWithLimitedFields(salaryStructureId);
  }

  private async getActiveByUserId(userId: string): Promise<SalaryStructureEntity | null> {
    return await this.salaryStructureRepository.findOne({
      where: {
        userId,
        isActive: true,
        effectiveTo: IsNull(),
      },
      order: { effectiveFrom: SortOrder.DESC },
    });
  }

  // ==================== Private Helpers ====================

  private async getEsicGrossLimit(): Promise<number> {
    const configuration = await this.configurationService.findOne({
      where: {
        key: CONFIGURATION_KEYS.ESIC_GROSS_LIMIT,
        module: CONFIGURATION_MODULES.SALARY,
      },
    });

    if (!configuration) {
      throw new BadRequestException(SALARY_STRUCTURE_ERRORS.ESIC_CONFIG_NOT_FOUND);
    }

    const configSetting = await this.configSettingService.findOne({
      where: { configId: configuration.id, isActive: true },
    });

    if (!configSetting?.value) {
      throw new BadRequestException(SALARY_STRUCTURE_ERRORS.ESIC_CONFIG_SETTING_NOT_FOUND);
    }

    return Number(configSetting.value);
  }

  private async validateEsic(dto: {
    esic?: number;
    basic: number;
    hra?: number;
    foodAllowance?: number;
    conveyanceAllowance?: number;
    medicalAllowance?: number;
    specialAllowance?: number;
  }): Promise<void> {
    if (dto.esic && dto.esic > 0) {
      const grossSalary =
        Number(dto.basic || 0) +
        Number(dto.hra || 0) +
        Number(dto.foodAllowance || 0) +
        Number(dto.conveyanceAllowance || 0) +
        Number(dto.medicalAllowance || 0) +
        Number(dto.specialAllowance || 0);

      const esicLimit = await this.getEsicGrossLimit();

      if (grossSalary > esicLimit) {
        throw new BadRequestException(
          SALARY_STRUCTURE_ERRORS.ESIC_NOT_APPLICABLE.replace(
            '{limit}',
            esicLimit.toLocaleString('en-IN'),
          ),
        );
      }
    }
  }

  private getSalarySnapshot(structure: SalaryStructureEntity): Record<string, any> {
    // Normalize effectiveFrom to YYYY-MM-DD string format for consistent storage
    let effectiveFromStr: string | null = null;
    if (structure.effectiveFrom) {
      const date =
        structure.effectiveFrom instanceof Date
          ? structure.effectiveFrom
          : new Date(structure.effectiveFrom);
      effectiveFromStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
    }

    return {
      basic: structure.basic,
      hra: structure.hra,
      foodAllowance: structure.foodAllowance,
      conveyanceAllowance: structure.conveyanceAllowance,
      medicalAllowance: structure.medicalAllowance,
      specialAllowance: structure.specialAllowance,
      employeePf: structure.employeePf,
      employerPf: structure.employerPf,
      tds: structure.tds,
      esic: structure.esic,
      professionalTax: structure.professionalTax,
      grossSalary: structure.grossSalary,
      totalDeductions: structure.totalDeductions,
      netSalary: structure.netSalary,
      ctc: structure.ctc,
      effectiveFrom: effectiveFromStr,
    };
  }

  private isSalaryComponentUpdate(dto: UpdateSalaryStructureDto): boolean {
    return (
      dto.basic !== undefined ||
      dto.hra !== undefined ||
      dto.foodAllowance !== undefined ||
      dto.conveyanceAllowance !== undefined ||
      dto.medicalAllowance !== undefined ||
      dto.specialAllowance !== undefined ||
      dto.esic !== undefined
    );
  }
}
