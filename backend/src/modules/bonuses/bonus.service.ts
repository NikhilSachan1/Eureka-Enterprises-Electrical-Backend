import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BonusRepository } from './bonus.repository';
import { CreateBonusDto, UpdateBonusDto, GetBonusDto } from './dto';
import { BonusEntity } from './entities/bonus.entity';
import { BonusStatus, BONUS_ERRORS, BONUS_RESPONSES } from './constants/bonus.constants';

@Injectable()
export class BonusService {
  constructor(private readonly bonusRepository: BonusRepository) {}

  async create(createDto: CreateBonusDto, createdBy: string) {
    return await this.bonusRepository.create({
      ...createDto,
      status: BonusStatus.PENDING,
      createdBy,
    });
  }

  async findAll(options: GetBonusDto) {
    return await this.bonusRepository.findAll(options);
  }

  async findOne(id: string): Promise<BonusEntity> {
    const bonus = await this.bonusRepository.findOne({
      where: { id, isActive: true },
      relations: ['user'],
    });
    if (!bonus) {
      throw new NotFoundException(BONUS_ERRORS.NOT_FOUND);
    }
    return bonus;
  }

  async update(id: string, updateDto: UpdateBonusDto, updatedBy: string) {
    const existing = await this.findOne(id);

    // Validate status transitions
    if (updateDto.status) {
      this.validateStatusChange(existing.status, updateDto.status);
    } else {
      // If not updating status, still check if modifications are allowed
      if (existing.status === BonusStatus.PAID) {
        throw new BadRequestException(BONUS_ERRORS.ALREADY_PAID);
      }
      if (existing.status === BonusStatus.CANCELLED) {
        throw new BadRequestException(BONUS_ERRORS.ALREADY_CANCELLED);
      }
    }

    await this.bonusRepository.update({ id }, { ...updateDto, updatedBy });

    return await this.findOne(id);
  }

  async delete(id: string, deletedBy: string): Promise<{ message: string }> {
    const existing = await this.findOne(id);

    if (existing.status === BonusStatus.PAID) {
      throw new BadRequestException(BONUS_ERRORS.ALREADY_PAID);
    }

    await this.bonusRepository.update(
      { id },
      { isActive: false, deletedBy, deletedAt: new Date() },
    );

    return { message: BONUS_RESPONSES.DELETED };
  }

  // Used by payroll service - Simple query using TypeORM find
  async getPendingBonusesForPayroll(
    userId: string,
    month: number,
    year: number,
  ): Promise<BonusEntity[]> {
    return await this.bonusRepository.findAllInternal({
      where: {
        userId,
        applicableMonth: month,
        applicableYear: year,
        status: BonusStatus.PENDING,
        isActive: true,
      },
    });
  }

  private validateStatusChange(currentStatus: string, newStatus: string): void {
    if (currentStatus === BonusStatus.PAID) {
      throw new BadRequestException(BONUS_ERRORS.ALREADY_PAID);
    }
    if (currentStatus === BonusStatus.CANCELLED) {
      throw new BadRequestException(BONUS_ERRORS.ALREADY_CANCELLED);
    }
    if (newStatus === BonusStatus.PAID && currentStatus !== BonusStatus.PENDING) {
      throw new BadRequestException(BONUS_ERRORS.INVALID_STATUS);
    }
  }
}
