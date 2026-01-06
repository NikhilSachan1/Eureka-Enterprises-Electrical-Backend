import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AnnouncementRepository } from './announcement.repository';
import { AnnouncementEntity } from './entities/announcement.entity';
import { EntityManager, FindOneOptions, FindOptionsWhere } from 'typeorm';
import {
  ANNOUNCEMENT_ERRORS,
  ANNOUNCEMENT_FIELD_NAMES,
  ANNOUNCEMENT_SUCCESS_MESSAGES,
  AnnouncementStatus,
  AnnouncementTargetType,
} from './constants/announcement.constants';
import {
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
  DeleteAnnouncementDto,
  GetAllAnnouncementsDto,
} from './dto';
import { DataSuccessOperationType } from 'src/utils/utility/constants/utility.constants';
import { UtilityService } from 'src/utils/utility/utility.service';
import { UserRoleService } from '../user-roles/user-role.service';
import {
  buildAnnouncementListQuery,
  buildAnnouncementTargetsQuery,
  buildExpireAnnouncementsQuery,
  buildUnacknowledgedAnnouncementsQuery,
  buildAcknowledgementDetailsQuery,
} from './queries';

@Injectable()
export class AnnouncementService {
  constructor(
    private announcementRepository: AnnouncementRepository,
    private utilityService: UtilityService,
    private userRoleService: UserRoleService,
  ) {}

  async create(
    createAnnouncementDto: CreateAnnouncementDto,
    userId: string,
  ): Promise<{ message: string }> {
    try {
      if (createAnnouncementDto.startAt && createAnnouncementDto.expiryAt) {
        const startDate = new Date(createAnnouncementDto.startAt);
        const expiryDate = new Date(createAnnouncementDto.expiryAt);
        if (startDate >= expiryDate) {
          throw new BadRequestException(ANNOUNCEMENT_ERRORS.INVALID_DATE_RANGE);
        }
      }

      const { targets, startAt, expiryAt, ...announcementData } = createAnnouncementDto;

      const announcement = await this.announcementRepository.create({
        ...announcementData,
        startAt: startAt ? new Date(startAt) : null,
        expiryAt: expiryAt ? new Date(expiryAt) : null,
        createdBy: userId,
        updatedBy: userId,
      });

      if (targets && targets.length > 0) {
        const targetEntities = targets.map((target) => ({
          announcementId: announcement.id,
          targetType: target.targetType,
          targetId: target.targetId,
          createdBy: userId,
          updatedBy: userId,
        }));
        await this.announcementRepository.createTargets(targetEntities);
      }

      return { message: ANNOUNCEMENT_SUCCESS_MESSAGES.CREATED };
    } catch (error) {
      throw error;
    }
  }

  async findOne(whereCondition: FindOneOptions<AnnouncementEntity>): Promise<AnnouncementEntity> {
    try {
      return this.announcementRepository.findOne(whereCondition);
    } catch (error) {
      throw error;
    }
  }

  async findOneOrFail(
    whereCondition: FindOneOptions<AnnouncementEntity>,
  ): Promise<AnnouncementEntity> {
    try {
      const announcement = await this.announcementRepository.findOne(whereCondition);
      if (!announcement) {
        throw new NotFoundException(ANNOUNCEMENT_ERRORS.NOT_FOUND);
      }
      return announcement;
    } catch (error) {
      throw error;
    }
  }

  async findAll(options: GetAllAnnouncementsDto) {
    try {
      const isUserView = !!options.userId;

      // Fetch roleIds from database via UserRoleService if user view
      if (isUserView && options.userId) {
        const userRoles = await this.userRoleService.findAll({ where: { userId: options.userId } });
        options.roleIds = userRoles.map((ur) => ur.roleId);
      }

      const { query, countQuery, params, countParams } = buildAnnouncementListQuery(
        options,
        isUserView,
      );

      const [records, countResult] = await Promise.all([
        this.announcementRepository.executeRawQuery(query, params),
        this.announcementRepository.executeRawQuery(countQuery, countParams),
      ]);

      const totalRecords = parseInt(countResult[0]?.total || '0');

      // For admin view, format stats
      if (!isUserView) {
        const formattedRecords = records.map((record: any) => {
          const { totalAck, acknowledgedCount, ...rest } = record;
          return {
            ...rest,
            stats: {
              total: parseInt(totalAck) || 0,
              acknowledged: parseInt(acknowledgedCount) || 0,
              pending: (parseInt(totalAck) || 0) - (parseInt(acknowledgedCount) || 0),
            },
          };
        });

        // Fetch targets for each announcement
        for (const record of formattedRecords) {
          const { query: targetQuery, params: targetParams } = buildAnnouncementTargetsQuery(
            record.id,
          );
          record.targets = await this.announcementRepository.executeRawQuery(
            targetQuery,
            targetParams,
          );
        }

        return this.utilityService.listResponse(formattedRecords, totalRecords);
      }

      return this.utilityService.listResponse(records, totalRecords);
    } catch (error) {
      throw error;
    }
  }

  async update(
    id: string,
    updateAnnouncementDto: UpdateAnnouncementDto,
    userId: string,
    entityManager?: EntityManager,
  ) {
    try {
      const announcement = await this.findOneOrFail({
        where: { id },
        relations: ['targets'],
      });

      if (updateAnnouncementDto.status) {
        this.validateStatusTransition(announcement, updateAnnouncementDto.status);
      }

      const startAt = updateAnnouncementDto.startAt || announcement.startAt;
      const expiryAt = updateAnnouncementDto.expiryAt || announcement.expiryAt;

      if (startAt && expiryAt) {
        const startDate = new Date(startAt);
        const expiryDate = new Date(expiryAt);
        if (startDate >= expiryDate) {
          throw new BadRequestException(ANNOUNCEMENT_ERRORS.INVALID_DATE_RANGE);
        }
      }

      const {
        targets,
        startAt: startAtStr,
        expiryAt: expiryAtStr,
        ...restUpdateData
      } = updateAnnouncementDto;

      const updateData: Partial<AnnouncementEntity> = {
        ...restUpdateData,
        updatedBy: userId,
      };

      if (startAtStr !== undefined) {
        updateData.startAt = startAtStr ? new Date(startAtStr) : null;
      }
      if (expiryAtStr !== undefined) {
        updateData.expiryAt = expiryAtStr ? new Date(expiryAtStr) : null;
      }

      if (
        updateAnnouncementDto.status === AnnouncementStatus.PUBLISHED &&
        !announcement.startAt &&
        !startAtStr
      ) {
        updateData.startAt = new Date();
      }

      await this.announcementRepository.update({ id }, updateData, entityManager);

      if (targets !== undefined) {
        await this.announcementRepository.deleteTargets({ announcementId: id }, entityManager);

        if (targets.length > 0) {
          const targetEntities = targets.map((target) => ({
            announcementId: id,
            targetType: target.targetType,
            targetId: target.targetId,
            createdBy: userId,
            updatedBy: userId,
          }));
          await this.announcementRepository.createTargets(targetEntities, entityManager);
        }
      }

      return this.utilityService.getSuccessMessage(
        ANNOUNCEMENT_FIELD_NAMES.ANNOUNCEMENT,
        DataSuccessOperationType.UPDATE,
      );
    } catch (error) {
      throw error;
    }
  }

  private validateStatusTransition(
    announcement: AnnouncementEntity,
    newStatus: AnnouncementStatus,
  ) {
    if (newStatus === AnnouncementStatus.PUBLISHED) {
      if (announcement.expiryAt && new Date(announcement.expiryAt) < new Date()) {
        throw new BadRequestException(ANNOUNCEMENT_ERRORS.CANNOT_PUBLISH_EXPIRED);
      }
    }
  }

  async delete(identifierConditions: FindOptionsWhere<AnnouncementEntity>, userId: string) {
    try {
      await this.findOneOrFail({ where: identifierConditions });
      await this.announcementRepository.update(identifierConditions, {
        deletedAt: new Date(),
        deletedBy: userId,
      });

      return this.utilityService.getSuccessMessage(
        ANNOUNCEMENT_FIELD_NAMES.ANNOUNCEMENT,
        DataSuccessOperationType.DELETE,
      );
    } catch (error) {
      throw error;
    }
  }

  async deleteBulk({ ids }: DeleteAnnouncementDto, userId: string) {
    try {
      const results = { success: [], failed: [] };
      for (const id of ids) {
        try {
          await this.delete({ id }, userId);
          results.success.push(id);
        } catch (error) {
          results.failed.push({ id, error: error.message });
        }
      }
      return results;
    } catch (error) {
      throw error;
    }
  }

  async acknowledge(announcementId: string, userId: string) {
    try {
      const announcement = await this.findOneOrFail({
        where: { id: announcementId },
        relations: ['targets'],
      });

      if (announcement.status !== AnnouncementStatus.PUBLISHED) {
        throw new BadRequestException(ANNOUNCEMENT_ERRORS.NOT_PUBLISHED);
      }

      if (announcement.expiryAt && new Date(announcement.expiryAt) < new Date()) {
        throw new BadRequestException(ANNOUNCEMENT_ERRORS.EXPIRED);
      }

      const userRoles = await this.userRoleService.findAll({ where: { userId } });
      const roleIds = userRoles.map((ur) => ur.roleId);

      const isTargeted = announcement.targets.some((target) => {
        if (target.targetType === AnnouncementTargetType.ALL) return true;
        if (target.targetType === AnnouncementTargetType.USER && target.targetId === userId)
          return true;
        if (target.targetType === AnnouncementTargetType.ROLE && roleIds.includes(target.targetId))
          return true;
        return false;
      });

      if (!isTargeted) {
        throw new BadRequestException(ANNOUNCEMENT_ERRORS.NOT_TARGETED);
      }

      const existingAck = await this.announcementRepository.findAck({
        where: { announcementId, userId },
      });

      if (existingAck?.acknowledged) {
        return this.utilityService.getSuccessMessage(
          ANNOUNCEMENT_FIELD_NAMES.ACKNOWLEDGEMENT,
          DataSuccessOperationType.CREATE,
        );
      }

      await this.announcementRepository.saveAck({
        ...(existingAck || {}),
        announcementId,
        userId,
        acknowledged: true,
        acknowledgedAt: new Date(),
        createdBy: existingAck ? existingAck.createdBy : userId,
        updatedBy: userId,
      });

      return this.utilityService.getSuccessMessage(
        ANNOUNCEMENT_FIELD_NAMES.ACKNOWLEDGEMENT,
        DataSuccessOperationType.CREATE,
      );
    } catch (error) {
      throw error;
    }
  }

  async expireAnnouncements() {
    try {
      // TODO: Write cron
      const { query, params } = buildExpireAnnouncementsQuery();
      await this.announcementRepository.executeRawQuery(query, params);
    } catch (error) {
      throw error;
    }
  }

  async getUnacknowledgedAnnouncements(userId: string) {
    try {
      const userRoles = await this.userRoleService.findAll({ where: { userId } });
      const roleIds = userRoles.map((ur) => ur.roleId);
      const { query, params } = buildUnacknowledgedAnnouncementsQuery(userId, roleIds);
      const records = await this.announcementRepository.executeRawQuery(query, params);
      return this.utilityService.listResponse(records, records.length);
    } catch (error) {
      throw error;
    }
  }

  async getAcknowledgementDetails(announcementId: string) {
    try {
      await this.findOneOrFail({ where: { id: announcementId } });

      const { query, params } = buildAcknowledgementDetailsQuery(announcementId);
      const records = await this.announcementRepository.executeRawQuery(query, params);

      const acknowledged = records.filter((r: any) => r.acknowledged).length;
      const pending = records.filter((r: any) => !r.acknowledged).length;

      return {
        records,
        totalRecords: records.length,
        acknowledged,
        pending,
      };
    } catch (error) {
      throw error;
    }
  }
}

// TODO: Email notification for announcements
