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
import { DateTimeService } from 'src/utils/datetime';

@Injectable()
export class AnnouncementService {
  private readonly DEFAULT_TIMEZONE = 'Asia/Kolkata';

  constructor(
    private announcementRepository: AnnouncementRepository,
    private utilityService: UtilityService,
    private userRoleService: UserRoleService,
    private dateTimeService: DateTimeService,
  ) {}

  /**
   * Converts an ISO date string (potentially in any timezone) to a UTC Date
   * by interpreting it as start-of-day or end-of-day in the given timezone.
   * This prevents the +05:30 offset shift when the frontend sends IST timestamps.
   *
   * If the string already has explicit timezone info (Z or +/-offset), JavaScript
   * handles it natively. If it's timezone-naive (e.g. "2026-04-19T23:24:01"),
   * it is interpreted as the given timezone and converted to UTC.
   */
  private parseDateWithTimezone(isoStr: string, timezone: string): Date {
    const tz = this.dateTimeService.getSafeTimezone(timezone);

    // String already has explicit timezone — let JS handle it directly
    if (/Z$|[+-]\d{2}:?\d{2}$/.test(isoStr)) {
      return new Date(isoStr);
    }

    // Timezone-naive string — interpret as the given timezone
    const [datePart, timePart = '00:00:00'] = isoStr.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour = 0, minute = 0, second = 0] = timePart.split(':').map(Number);

    // Build a local Date then compute the offset for the target timezone
    const tempDate = new Date(year, month - 1, day, hour, minute, second);
    const utcWall = new Date(tempDate.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzWall = new Date(tempDate.toLocaleString('en-US', { timeZone: tz }));
    const offsetMs = utcWall.getTime() - tzWall.getTime();

    return new Date(tempDate.getTime() + offsetMs);
  }

  async create(
    createAnnouncementDto: CreateAnnouncementDto,
    userId: string,
    timezone?: string,
  ): Promise<{ message: string }> {
    try {
      const tz = timezone || this.DEFAULT_TIMEZONE;

      if (createAnnouncementDto.startAt && createAnnouncementDto.expiryAt) {
        const startDate = this.parseDateWithTimezone(createAnnouncementDto.startAt, tz);
        const expiryDate = this.parseDateWithTimezone(createAnnouncementDto.expiryAt, tz);
        if (startDate >= expiryDate) {
          throw new BadRequestException(ANNOUNCEMENT_ERRORS.INVALID_DATE_RANGE);
        }
      }

      const { targets, startAt, expiryAt, ...announcementData } = createAnnouncementDto;

      const announcement = await this.announcementRepository.create({
        ...announcementData,
        startAt: startAt ? this.parseDateWithTimezone(startAt, tz) : null,
        expiryAt: expiryAt ? this.parseDateWithTimezone(expiryAt, tz) : null,
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

  async getAnnouncementById(id: string) {
    try {
      const announcement = await this.announcementRepository.findOne({
        where: { id },
        relations: ['targets', 'createdByUser', 'updatedByUser'],
      });

      if (!announcement) {
        throw new NotFoundException(ANNOUNCEMENT_ERRORS.NOT_FOUND);
      }

      // Fetch user details for USER type targets
      const userTargets = announcement.targets?.filter(
        (t) => t.targetType === AnnouncementTargetType.USER,
      );

      let userDetailsMap: Record<string, any> = {};
      if (userTargets?.length > 0) {
        const userIds = userTargets.map((t) => t.targetId);
        const query = `
          SELECT id, "firstName", "lastName", "employeeId"
          FROM users
          WHERE id = ANY($1) AND "deletedAt" IS NULL
        `;
        const users = await this.announcementRepository.executeRawQuery(query, [userIds]);
        userDetailsMap = users.reduce((acc: Record<string, any>, user: any) => {
          acc[user.id] = user;
          return acc;
        }, {});
      }

      return {
        id: announcement.id,
        title: announcement.title,
        message: announcement.message,
        status: announcement.status,
        startAt: announcement.startAt,
        expiryAt: announcement.expiryAt,
        publishedAt: announcement.publishedAt,
        expiredAt: announcement.expiredAt,
        createdAt: announcement.createdAt,
        updatedAt: announcement.updatedAt,
        createdByUser: announcement.createdByUser
          ? {
              id: announcement.createdByUser.id,
              firstName: announcement.createdByUser.firstName,
              lastName: announcement.createdByUser.lastName,
              email: announcement.createdByUser.email,
              employeeId: announcement.createdByUser.employeeId,
            }
          : null,
        updatedByUser: announcement.updatedByUser
          ? {
              id: announcement.updatedByUser.id,
              firstName: announcement.updatedByUser.firstName,
              lastName: announcement.updatedByUser.lastName,
              email: announcement.updatedByUser.email,
              employeeId: announcement.updatedByUser.employeeId,
            }
          : null,
        targets:
          announcement.targets?.map((target) => {
            const userDetail = userDetailsMap[target.targetId];
            return {
              targetId: target.targetId,
              targetType: target.targetType,
              employeeName:
                target.targetType === AnnouncementTargetType.USER && userDetail
                  ? `${userDetail.firstName} ${userDetail.lastName}`
                  : null,
              employeeId:
                target.targetType === AnnouncementTargetType.USER && userDetail
                  ? userDetail.employeeId
                  : null,
            };
          }) || [],
      };
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
    timezone?: string,
  ) {
    try {
      const tz = timezone || this.DEFAULT_TIMEZONE;

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
        const startDate = updateAnnouncementDto.startAt
          ? this.parseDateWithTimezone(updateAnnouncementDto.startAt, tz)
          : new Date(announcement.startAt);
        const expiryDate = updateAnnouncementDto.expiryAt
          ? this.parseDateWithTimezone(updateAnnouncementDto.expiryAt, tz)
          : new Date(announcement.expiryAt);
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
        updateData.startAt = startAtStr ? this.parseDateWithTimezone(startAtStr, tz) : null;
      }
      if (expiryAtStr !== undefined) {
        updateData.expiryAt = expiryAtStr ? this.parseDateWithTimezone(expiryAtStr, tz) : null;
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
      const results: { id: string; success: boolean; message: string }[] = [];

      for (const id of ids) {
        try {
          await this.delete({ id }, userId);
          results.push({
            id,
            success: true,
            message: 'Announcement deleted successfully',
          });
        } catch (error) {
          results.push({
            id,
            success: false,
            message: error.message || 'Failed to delete announcement',
          });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      return {
        message: `Bulk delete completed: ${successCount} succeeded, ${failureCount} failed`,
        totalRequested: ids.length,
        successCount,
        failureCount,
        results,
      };
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
