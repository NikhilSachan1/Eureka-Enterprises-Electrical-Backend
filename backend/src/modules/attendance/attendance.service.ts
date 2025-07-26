import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, FindOneOptions } from 'typeorm';
import { AttendanceRepository } from './attendance.repository';
import {
  AttendanceActionDto,
  RegularizeAttendanceDto,
  ForceAttendanceDto,
  AttendanceQueryDto,
  AttendanceListResponseDto,
  AttendanceRecordDto,
  AttendanceStatsDto,
  AttendanceBulkApprovalDto,
  AttendanceApprovalDto,
} from './dto';
import {
  ATTENDANCE_ERRORS,
  ATTENDANCE_RESPONSES,
  AttendanceStatus,
  AttendanceType,
  ApprovalStatus,
  AttendanceAction,
  DEFAULT_APPROVAL_COMMENT,
  ShiftStatus,
} from './constants/attendance.constants';
import { ConfigurationService } from '../configurations/configuration.service';
import {
  CONFIGURATION_KEYS,
  CONFIGURATION_MODULES,
} from '../../utils/master-constants/master-constants';
import { AttendanceEntity } from './entities/attendance.entity';
import { UtilityService } from '../../utils/utility/utility.service';
import { buildAttendanceListQuery, buildAttendanceStatsQuery } from './queries/attendance-queries';
import { AttendanceHistoryDto } from './dto/attendance-history.dto';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly attendanceRepository: AttendanceRepository,
    private readonly configurationService: ConfigurationService,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly utilityService: UtilityService,
  ) {}

  async handleAttendanceAction(userId: string, attendanceActionDto: AttendanceActionDto) {
    const { action, entrySourceType, attendanceType, notes } = attendanceActionDto;
    const today = new Date();
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const { configSettingId, shiftConfigs } = await this.getShiftConfigs();

    return await this.dataSource.transaction(async (entityManager) => {
      const existingAttendance = await this.attendanceRepository.findOne(
        {
          where: {
            userId,
            attendanceDate: todayDate,
            isActive: true,
          },
        },
        entityManager,
      );

      switch (action) {
        case AttendanceAction.CHECK_IN:
          return await this.handleCheckIn(
            userId,
            existingAttendance,
            todayDate,
            today,
            entrySourceType,
            attendanceType,
            notes,
            configSettingId,
            shiftConfigs,
            entityManager,
          );
        case AttendanceAction.CHECK_OUT:
          return await this.handleCheckOut(
            userId,
            existingAttendance,
            today,
            shiftConfigs,
            notes,
            entityManager,
          );
        default:
          throw new BadRequestException(ATTENDANCE_ERRORS.INVALID_ACTION);
      }
    });
  }

  private async handleCheckIn(
    userId: string,
    existingAttendance: AttendanceEntity,
    todayDate: Date,
    currentTime: Date,
    entrySourceType: string,
    attendanceType: AttendanceType,
    notes: string,
    configSettingId: string,
    shiftConfigs: any,
    entityManager: any,
  ) {
    await this.validateShiftTiming(shiftConfigs, currentTime);

    if (existingAttendance) {
      const hasCheckedIn =
        existingAttendance.checkInTime && existingAttendance.status === AttendanceStatus.CHECKED_IN;

      if (!shiftConfigs.multiplePunchesInOneDay && hasCheckedIn) {
        throw new BadRequestException(ATTENDANCE_ERRORS.ALREADY_CHECKED_IN);
      }

      if (shiftConfigs.multiplePunchesInOneDay && hasCheckedIn) {
        throw new BadRequestException(ATTENDANCE_ERRORS.MUST_CHECK_OUT_FIRST);
      }

      if (existingAttendance.approvalStatus === ApprovalStatus.REJECTED) {
        throw new BadRequestException(ATTENDANCE_ERRORS.ATTENDANCE_REJECTED);
      }

      if (shiftConfigs.multiplePunchesInOneDay) {
        await this.attendanceRepository.update(
          { userId, attendanceDate: todayDate, isActive: true },
          { isActive: false, updatedBy: userId },
          entityManager,
        );
      }
    }

    await this.attendanceRepository.create(
      {
        userId,
        attendanceDate: todayDate,
        checkInTime: currentTime,
        status: AttendanceStatus.CHECKED_IN,
        entrySourceType,
        attendanceType,
        approvalStatus: ApprovalStatus.PENDING,
        notes,
        shiftConfigId: configSettingId,
        isActive: true,
        createdBy: userId,
      },
      entityManager,
    );

    return {
      message: ATTENDANCE_RESPONSES.CHECK_IN_SUCCESS,
      checkInTime: currentTime,
    };
  }

  private async handleCheckOut(
    userId: string,
    existingAttendance: AttendanceEntity,
    currentTime: Date,
    shiftConfigs: any,
    notes: string,
    entityManager: any,
  ) {
    await this.validateShiftTiming(shiftConfigs, currentTime);

    if (!shiftConfigs.manualCheckOut) {
      throw new BadRequestException(ATTENDANCE_ERRORS.MANUAL_CHECK_OUT_NOT_ALLOWED);
    }

    if (
      !existingAttendance?.checkInTime ||
      existingAttendance.status !== AttendanceStatus.CHECKED_IN ||
      existingAttendance.checkOutTime ||
      existingAttendance.approvalStatus === ApprovalStatus.REJECTED
    ) {
      const errorMsg = !existingAttendance?.checkInTime
        ? ATTENDANCE_ERRORS.NOT_CHECKED_IN
        : existingAttendance.checkOutTime
        ? ATTENDANCE_ERRORS.ALREADY_CHECKED_OUT
        : ATTENDANCE_ERRORS.ATTENDANCE_REJECTED;

      throw new BadRequestException(errorMsg);
    }

    await this.attendanceRepository.update(
      { id: existingAttendance.id },
      {
        checkOutTime: currentTime,
        status:
          existingAttendance.approvalStatus === ApprovalStatus.PENDING
            ? AttendanceStatus.APPROVAL_PENDING
            : existingAttendance.status,
        notes: notes
          ? `${existingAttendance.notes || ''} / ${notes}`.trim()
          : existingAttendance.notes,
        updatedBy: userId,
      },
      entityManager,
    );

    const workDurationSeconds =
      (currentTime.getTime() - new Date(existingAttendance.checkInTime).getTime()) / 1000;

    return {
      message: ATTENDANCE_RESPONSES.CHECK_OUT_SUCCESS,
      checkOutTime: currentTime,
      workDuration: workDurationSeconds,
    };
  }

  private async getShiftConfigs() {
    const {
      configSettings: [{ id: configSettingId, value: shiftConfigs }],
    } = await this.configurationService.findOneOrFail({
      where: {
        module: CONFIGURATION_MODULES.ATTENDANCE,
        key: CONFIGURATION_KEYS.SHIFT_CONFIGS,
      },
      relations: { configSettings: true },
      select: { configSettings: { id: true, value: true } },
    });
    return { configSettingId, shiftConfigs };
  }

  private async validateShiftTiming(shiftTimings: any, currentTime: Date) {
    // Convert current time to UTC for validation
    const currentHourMinute = currentTime.getUTCHours() * 100 + currentTime.getUTCMinutes();
    const [startHour, startMinute] = shiftTimings.startTime.split(':').map(Number);
    const [endHour, endMinute] = shiftTimings.endTime.split(':').map(Number);
    const shiftStart = startHour * 100 + startMinute;
    const shiftEnd = endHour * 100 + endMinute;

    if (currentHourMinute < shiftStart || currentHourMinute >= shiftEnd) {
      throw new BadRequestException(
        ATTENDANCE_ERRORS.INVALID_SHIFT_TIMING.replace('{start}', shiftTimings.startTime).replace(
          '{end}',
          shiftTimings.endTime,
        ),
      );
    }
  }

  async regularizeAttendance(
    attendanceId: string,
    regularizeAttendanceDto: RegularizeAttendanceDto,
  ) {
    //TODO: Remove redunant code and make it more readable
    const {
      checkInTime,
      checkOutTime,
      notes,
      status,
      userId,
      timezone,
      entrySourceType,
      attendanceType,
    } = regularizeAttendanceDto;
    const existingAttendance = await this.findOneOrFail({
      where: {
        userId,
        id: attendanceId,
        isActive: true,
      },
    });
    if (existingAttendance.status === status) {
      throw new BadRequestException(
        ATTENDANCE_ERRORS.ALREADY_REGULARIZED.replace('{status}', status),
      );
    }
    const { shiftConfigs } = await this.getShiftConfigs();
    await this.isRegularizationAllowed(existingAttendance);

    if (checkInTime && checkOutTime) {
      const checkInTimeUTC = this.utilityService.convertLocalTimeToUTC(checkInTime, timezone);
      const checkOutTimeUTC = this.utilityService.convertLocalTimeToUTC(checkOutTime, timezone);

      await this.validateTimeWithinShift(shiftConfigs, checkInTimeUTC, 'Check-in');
      await this.validateTimeWithinShift(shiftConfigs, checkOutTimeUTC, 'Check-out');

      if (checkOutTimeUTC <= checkInTimeUTC) {
        throw new BadRequestException(ATTENDANCE_ERRORS.INVALID_CHECK_OUT_TIME);
      }
    }

    return await this.dataSource.transaction(async (entityManager) => {
      const checkInTimeUTC = this.utilityService.convertLocalTimeToUTC(
        checkInTime,
        timezone || shiftConfigs.timezone,
      );
      const checkOutTimeUTC = this.utilityService.convertLocalTimeToUTC(
        checkOutTime,
        timezone || shiftConfigs.timezone,
      );
      switch (status) {
        case AttendanceStatus.PRESENT:
          if (existingAttendance.status === AttendanceStatus.ABSENT) {
            await this.attendanceRepository.update(
              { id: attendanceId },
              {
                isActive: false,
                updatedBy: userId,
              },
              entityManager,
            );

            await this.attendanceRepository.create({
              userId,
              attendanceDate: existingAttendance.attendanceDate,
              checkInTime: checkInTimeUTC,
              checkOutTime: checkOutTimeUTC,
              status: AttendanceStatus.PRESENT,
              notes,
              attendanceType,
              entrySourceType,
              approvalStatus: ApprovalStatus.APPROVED,
              approvalBy: userId,
              approvalAt: new Date(),
              approvalComment: DEFAULT_APPROVAL_COMMENT[status.toUpperCase()],
              regularizedBy: userId,
              shiftConfigId: existingAttendance.shiftConfigId,
              isActive: true,
              createdBy: userId,
              updatedBy: userId,
            });
          }
          if (existingAttendance.status === AttendanceStatus.APPROVAL_PENDING) {
            await this.attendanceRepository.update(
              { id: attendanceId },
              {
                isActive: false,
                updatedBy: userId,
              },
              entityManager,
            );

            await this.attendanceRepository.create({
              userId,
              attendanceDate: existingAttendance.attendanceDate,
              checkInTime: checkInTimeUTC,
              checkOutTime: checkOutTimeUTC,
              status: AttendanceStatus.PRESENT,
              notes,
              attendanceType,
              entrySourceType,
              approvalStatus: ApprovalStatus.APPROVED,
              approvalBy: userId,
              approvalAt: new Date(),
              approvalComment: DEFAULT_APPROVAL_COMMENT[status.toUpperCase()],
              regularizedBy: userId,
              shiftConfigId: existingAttendance.shiftConfigId,
              isActive: true,
              createdBy: userId,
              updatedBy: userId,
            });
          }
          if (existingAttendance.status === AttendanceStatus.LEAVE) {
            //   TODO: LEAVE REVERT and credit back and mark present
          }
          if (existingAttendance.status === AttendanceStatus.HOLIDAY) {
            //   TODO: HOLIDAY REVERT AND PROVIDE 1 LEAVE

            await this.attendanceRepository.update(
              { id: attendanceId },
              {
                isActive: false,
                updatedBy: userId,
              },
            );

            await this.attendanceRepository.create({
              userId,
              attendanceDate: existingAttendance.attendanceDate,
              checkInTime: checkInTimeUTC,
              checkOutTime: checkOutTimeUTC,
              status: AttendanceStatus.PRESENT,
              notes,
              attendanceType,
              entrySourceType,
              approvalStatus: ApprovalStatus.APPROVED,
              approvalBy: userId,
              approvalAt: new Date(),
              approvalComment: DEFAULT_APPROVAL_COMMENT[status.toUpperCase()],
              regularizedBy: userId,
              shiftConfigId: existingAttendance.shiftConfigId,
              isActive: true,
              createdBy: userId,
              updatedBy: userId,
            });
          }
          if (existingAttendance.status === AttendanceStatus.CHECKED_IN) {
            await this.attendanceRepository.update(
              { id: attendanceId },
              {
                isActive: false,
                updatedBy: userId,
              },
            );

            await this.attendanceRepository.create({
              userId,
              attendanceDate: existingAttendance.attendanceDate,
              checkInTime: checkInTimeUTC,
              status: AttendanceStatus.PRESENT,
              notes,
              attendanceType,
              entrySourceType,
              approvalStatus: ApprovalStatus.APPROVED,
              approvalBy: userId,
              approvalAt: new Date(),
              approvalComment: DEFAULT_APPROVAL_COMMENT[status.toUpperCase()],
              shiftConfigId: existingAttendance.shiftConfigId,
              regularizedBy: userId,
              isActive: true,
              createdBy: userId,
              updatedBy: userId,
            });
          }
          break;
        case AttendanceStatus.ABSENT:
          if (existingAttendance.status === AttendanceStatus.PRESENT) {
            await this.attendanceRepository.update(
              { id: attendanceId },
              {
                isActive: false,
                updatedBy: userId,
              },
            );

            await this.attendanceRepository.create({
              userId,
              attendanceDate: existingAttendance.attendanceDate,
              status: AttendanceStatus.ABSENT,
              notes,
              attendanceType,
              entrySourceType,
              approvalStatus: ApprovalStatus.APPROVED,
              approvalBy: userId,
              approvalAt: new Date(),
              approvalComment: DEFAULT_APPROVAL_COMMENT[status.toUpperCase()],
              regularizedBy: userId,
              shiftConfigId: existingAttendance.shiftConfigId,
              isActive: true,
              createdBy: userId,
              updatedBy: userId,
            });
          }
          if (existingAttendance.status === AttendanceStatus.APPROVAL_PENDING) {
            await this.attendanceRepository.update(
              { id: attendanceId },
              {
                isActive: false,
                updatedBy: userId,
              },
            );

            await this.attendanceRepository.create({
              userId,
              attendanceDate: existingAttendance.attendanceDate,
              status: AttendanceStatus.ABSENT,
              notes,
              attendanceType,
              entrySourceType,
              approvalStatus: ApprovalStatus.APPROVED,
              approvalBy: userId,
              approvalAt: new Date(),
              approvalComment: DEFAULT_APPROVAL_COMMENT[status.toUpperCase()],
              regularizedBy: userId,
              shiftConfigId: existingAttendance.shiftConfigId,
              isActive: true,
              createdBy: userId,
              updatedBy: userId,
            });
          }
          if (existingAttendance.status === AttendanceStatus.LEAVE) {
            // TODO: LEAVE CREDIT BACK and MARK ABSENT -> only leave credit is pending

            await this.attendanceRepository.update(
              { id: attendanceId },
              {
                isActive: false,
                updatedBy: userId,
              },
            );

            await this.attendanceRepository.create({
              userId,
              attendanceDate: existingAttendance.attendanceDate,
              status: AttendanceStatus.ABSENT,
              notes,
              attendanceType,
              entrySourceType,
              approvalStatus: ApprovalStatus.APPROVED,
              approvalBy: userId,
              approvalAt: new Date(),
              approvalComment: DEFAULT_APPROVAL_COMMENT[status.toUpperCase()],
              regularizedBy: userId,
              shiftConfigId: existingAttendance.shiftConfigId,
              isActive: true,
              createdBy: userId,
              updatedBy: userId,
            });
          }
          if (existingAttendance.status === AttendanceStatus.HOLIDAY) {
            throw new BadRequestException(
              ATTENDANCE_ERRORS.HOLIDAY_NOT_ALLOWED_AS_ABSENT_REGULARIZE,
            );
          }
          if (existingAttendance.status === AttendanceStatus.CHECKED_IN) {
            await this.attendanceRepository.update(
              { id: attendanceId },
              {
                isActive: false,
                updatedBy: userId,
              },
            );

            await this.attendanceRepository.create({
              userId,
              attendanceDate: existingAttendance.attendanceDate,
              status: AttendanceStatus.ABSENT,
              notes,
              attendanceType,
              entrySourceType,
              approvalStatus: ApprovalStatus.APPROVED,
              approvalBy: userId,
              approvalAt: new Date(),
              approvalComment: DEFAULT_APPROVAL_COMMENT[status.toUpperCase()],
              regularizedBy: userId,
              shiftConfigId: existingAttendance.shiftConfigId,
              isActive: true,
              createdBy: userId,
              updatedBy: userId,
            });
          }
          break;
        case AttendanceStatus.LEAVE:
          if (
            [
              AttendanceStatus.PRESENT,
              AttendanceStatus.ABSENT,
              AttendanceStatus.APPROVAL_PENDING,
              AttendanceStatus.CHECKED_IN,
            ].includes(existingAttendance.status as AttendanceStatus)
          ) {
            // TODO: apply leave and mark leave in attendance -> only leave credit is pending

            await this.attendanceRepository.update(
              { id: attendanceId },
              {
                isActive: false,
                updatedBy: userId,
              },
            );

            await this.attendanceRepository.create({
              userId,
              attendanceDate: existingAttendance.attendanceDate,
              status: AttendanceStatus.LEAVE,
              notes,
              attendanceType,
              entrySourceType,
              approvalStatus: ApprovalStatus.APPROVED,
              approvalBy: userId,
              approvalAt: new Date(),
              approvalComment: DEFAULT_APPROVAL_COMMENT[status.toUpperCase()],
              regularizedBy: userId,
              shiftConfigId: existingAttendance.shiftConfigId,
              isActive: true,
              createdBy: userId,
              updatedBy: userId,
            });
          }
          if (existingAttendance.status === AttendanceStatus.HOLIDAY) {
            throw new BadRequestException(
              ATTENDANCE_ERRORS.HOLIDAY_NOT_ALLOWED_AS_LEAVE_REGULARIZE,
            );
          }
          break;
        case AttendanceStatus.HOLIDAY:
          if (existingAttendance.status === AttendanceStatus.PRESENT) {
            // TODO: MARK HOLIDAY

            await this.attendanceRepository.update(
              { id: attendanceId },
              {
                isActive: false,
                updatedBy: userId,
              },
            );

            await this.attendanceRepository.create({
              userId,
              attendanceDate: existingAttendance.attendanceDate,
              status: AttendanceStatus.HOLIDAY,
              notes,
              attendanceType,
              entrySourceType,
              approvalStatus: ApprovalStatus.APPROVED,
              approvalBy: userId,
              approvalAt: new Date(),
              approvalComment: DEFAULT_APPROVAL_COMMENT[status.toUpperCase()],
              regularizedBy: userId,
              shiftConfigId: existingAttendance.shiftConfigId,
              isActive: true,
              createdBy: userId,
              updatedBy: userId,
            });
          }
          if (existingAttendance.status === AttendanceStatus.ABSENT) {
            // TODO: MARK HOLIDAY
            await this.attendanceRepository.update(
              { id: attendanceId },
              {
                isActive: false,
                updatedBy: userId,
              },
            );

            await this.attendanceRepository.create({
              userId,
              attendanceDate: existingAttendance.attendanceDate,
              status: AttendanceStatus.HOLIDAY,
              notes,
              attendanceType,
              entrySourceType,
              approvalStatus: ApprovalStatus.APPROVED,
              approvalBy: userId,
              approvalAt: new Date(),
              approvalComment: DEFAULT_APPROVAL_COMMENT[status.toUpperCase()],
              regularizedBy: userId,
              shiftConfigId: existingAttendance.shiftConfigId,
              isActive: true,
              createdBy: userId,
              updatedBy: userId,
            });
          }
          if (existingAttendance.status === AttendanceStatus.LEAVE) {
            // TODO: PROVIDE 1 LEAVE and mark holiday
            await this.attendanceRepository.update(
              { id: attendanceId },
              {
                isActive: false,
                updatedBy: userId,
              },
            );
            await this.attendanceRepository.create({
              userId,
              attendanceDate: existingAttendance.attendanceDate,
              status: AttendanceStatus.HOLIDAY,
              notes,
              attendanceType,
              entrySourceType,
              approvalStatus: ApprovalStatus.APPROVED,
              approvalBy: userId,
              approvalAt: new Date(),
              approvalComment: DEFAULT_APPROVAL_COMMENT[status.toUpperCase()],
              regularizedBy: userId,
              shiftConfigId: existingAttendance.shiftConfigId,
              isActive: true,
              createdBy: userId,
              updatedBy: userId,
            });
          }
          if (existingAttendance.status === AttendanceStatus.APPROVAL_PENDING) {
            // TODO: MARK HOLIDAY
            await this.attendanceRepository.update(
              { id: attendanceId },
              {
                isActive: false,
                updatedBy: userId,
              },
            );
            await this.attendanceRepository.create({
              userId,
              attendanceDate: existingAttendance.attendanceDate,
              status: AttendanceStatus.HOLIDAY,
              notes,
              attendanceType,
              entrySourceType,
              approvalStatus: ApprovalStatus.APPROVED,
              approvalBy: userId,
              approvalAt: new Date(),
              approvalComment: DEFAULT_APPROVAL_COMMENT[status.toUpperCase()],
              regularizedBy: userId,
              shiftConfigId: existingAttendance.shiftConfigId,
              isActive: true,
              createdBy: userId,
              updatedBy: userId,
            });
          }
          if (existingAttendance.status === AttendanceStatus.CHECKED_IN) {
            // TODO: MARK HOLIDAY
            await this.attendanceRepository.update(
              { id: attendanceId },
              {
                isActive: false,
                updatedBy: userId,
              },
            );
            await this.attendanceRepository.create({
              userId,
              attendanceDate: existingAttendance.attendanceDate,
              status: AttendanceStatus.HOLIDAY,
              notes,
              attendanceType,
              entrySourceType,
              approvalStatus: ApprovalStatus.APPROVED,
              approvalBy: userId,
              approvalAt: new Date(),
              approvalComment: DEFAULT_APPROVAL_COMMENT[status.toUpperCase()],
              regularizedBy: userId,
              shiftConfigId: existingAttendance.shiftConfigId,
              isActive: true,
              createdBy: userId,
              updatedBy: userId,
            });
          }
          break;
        default:
          throw new BadRequestException(ATTENDANCE_ERRORS.INVALID_STATUS);
      }
      return {
        message: ATTENDANCE_RESPONSES.ATTENDANCE_REGULARIZED,
        attendanceId,
      };
    });
  }

  private async validateTimeWithinShift(shiftConfigs: any, timeToValidate: Date, timeType: string) {
    const timeHourMinute = timeToValidate.getUTCHours() * 100 + timeToValidate.getUTCMinutes();
    const [startHour, startMinute] = shiftConfigs.startTime.split(':').map(Number);
    const [endHour, endMinute] = shiftConfigs.endTime.split(':').map(Number);
    const shiftStart = startHour * 100 + startMinute;
    const shiftEnd = endHour * 100 + endMinute;

    if (timeHourMinute < shiftStart || timeHourMinute > shiftEnd) {
      throw new BadRequestException(
        ATTENDANCE_ERRORS.INVALID_TIME.replace('{start}', shiftConfigs.startTime)
          .replace('{end}', shiftConfigs.endTime)
          .replace('{timeType}', timeType),
      );
    }
  }

  private async isRegularizationAllowed({ attendanceDate }: { attendanceDate: Date }) {
    const {
      configSettings: [{ id: configSettingId, value: regularizationConfigs }],
    } = await this.configurationService.findOneOrFail({
      where: {
        module: CONFIGURATION_MODULES.ATTENDANCE,
        key: CONFIGURATION_KEYS.REGULARIZATION_CONFIGS,
      },
      relations: { configSettings: true },
      select: { configSettings: { id: true, value: true } },
    });

    if (!regularizationConfigs.isRegularizationAllowed) {
      throw new BadRequestException(ATTENDANCE_ERRORS.REGULARIZATION_NOT_ALLOWED);
    }

    const today = new Date().setHours(0, 0, 0, 0);
    const attendanceDay = new Date(attendanceDate).setHours(0, 0, 0, 0);

    if (attendanceDay > today) {
      throw new BadRequestException(ATTENDANCE_ERRORS.FUTURE_DATE_REGULARIZATION_NOT_ALLOWED);
    }

    if (attendanceDay < today) {
      return { configSettingId, regularizationConfigs };
    }

    // Commented for now as we are allowing regularization during shift hours
    // if (attendanceDateOnly.getTime() === todayDate.getTime()) {
    //   const currentTime = new Date();
    //   const currentHourMinute = currentTime.getUTCHours() * 100 + currentTime.getUTCMinutes();
    //   const [endHour, endMinute] = shiftConfigs.endTime.split(':').map(Number);
    //   const shiftEnd = endHour * 100 + endMinute;

    //   if (currentHourMinute <= shiftEnd) {
    //     throw new BadRequestException(ATTENDANCE_ERRORS.REGULARIZATION_NOT_ALLOWED_DURING_SHIFT);
    //   }
    // }

    return { configSettingId, regularizationConfigs };
  }

  async findOne(options: FindOneOptions<AttendanceEntity>): Promise<AttendanceEntity> {
    try {
      return await this.attendanceRepository.findOne(options);
    } catch (error) {
      throw error;
    }
  }

  async findOneOrFail(options: FindOneOptions<AttendanceEntity>): Promise<AttendanceEntity> {
    try {
      const attendance = await this.attendanceRepository.findOne(options);

      if (!attendance) {
        throw new NotFoundException(ATTENDANCE_ERRORS.NOT_FOUND);
      }

      return attendance;
    } catch (error) {
      throw error;
    }
  }

  async forceAttendance(createdBy: string, forceAttendanceDto: ForceAttendanceDto) {
    const {
      userId,
      attendanceDate,
      checkInTime,
      checkOutTime,
      reason,
      notes,
      timezone,
      entrySourceType,
      attendanceType,
    } = forceAttendanceDto;

    const targetDate = new Date(attendanceDate);
    const today = new Date();
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const targetDateOnly = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
    );

    // Validate date is not in future
    if (targetDateOnly > todayDate) {
      throw new BadRequestException(ATTENDANCE_ERRORS.FORCE_ATTENDANCE_FUTURE_DATE_NOT_ALLOWED);
    }

    const { configSettingId, shiftConfigs } = await this.getShiftConfigs();
    const isPreviousDay = targetDateOnly < todayDate;
    const isSameDay = targetDateOnly.getTime() === todayDate.getTime();

    return await this.dataSource.transaction(async (entityManager) => {
      const existingAttendance = await this.attendanceRepository.findOne(
        {
          where: {
            userId,
            attendanceDate: targetDateOnly,
            isActive: true,
          },
        },
        entityManager,
      );

      if (existingAttendance) {
        throw new BadRequestException(ATTENDANCE_ERRORS.FORCE_ATTENDANCE_ALREADY_EXISTS);
      }

      if (isSameDay) {
        return await this.handleSameDayForceAttendance(
          userId,
          createdBy,
          targetDateOnly,
          today,
          checkInTime,
          checkOutTime,
          reason,
          notes,
          shiftConfigs,
          configSettingId,
          entrySourceType,
          attendanceType,
          timezone,
          entityManager,
        );
      } else if (isPreviousDay) {
        return await this.handlePreviousDayForceAttendance(
          userId,
          createdBy,
          targetDateOnly,
          checkInTime,
          checkOutTime,
          reason,
          notes,
          configSettingId,
          entrySourceType,
          attendanceType,
          timezone,
          entityManager,
        );
      }
    });
  }

  private async handleSameDayForceAttendance(
    userId: string,
    createdBy: string,
    targetDate: Date,
    currentTime: Date,
    checkInTime: string,
    checkOutTime: string,
    reason: string,
    notes: string,
    shiftConfigs: any,
    configSettingId: string,
    entrySourceType: string,
    attendanceType: AttendanceType,
    timezone: string,
    entityManager: any,
  ) {
    const shiftStatus = await this.getShiftStatus(shiftConfigs, currentTime);

    switch (shiftStatus) {
      case ShiftStatus.BEFORE_SHIFT:
        throw new BadRequestException(ATTENDANCE_ERRORS.FORCE_ATTENDANCE_BEFORE_SHIFT_NOT_ALLOWED);

      case ShiftStatus.DURING_SHIFT:
        return await this.handleDuringShiftForceAttendance(
          userId,
          createdBy,
          targetDate,
          currentTime,
          checkInTime,
          reason,
          notes,
          shiftConfigs,
          configSettingId,
          entrySourceType,
          attendanceType,
          timezone,
          entityManager,
        );

      case ShiftStatus.AFTER_SHIFT:
        return await this.handleAfterShiftForceAttendance(
          userId,
          createdBy,
          targetDate,
          currentTime,
          checkInTime,
          checkOutTime,
          reason,
          notes,
          shiftConfigs,
          configSettingId,
          entrySourceType,
          attendanceType,
          timezone,
          entityManager,
        );

      default:
        throw new BadRequestException(ATTENDANCE_ERRORS.FORCE_ATTENDANCE_INVALID_STATUS);
    }
  }

  private async getShiftStatus(shiftConfigs: any, currentTime: Date): Promise<ShiftStatus> {
    const currentHourMinute = currentTime.getUTCHours() * 100 + currentTime.getUTCMinutes();
    const [startHour, startMinute] = shiftConfigs.startTime.split(':').map(Number);
    const [endHour, endMinute] = shiftConfigs.endTime.split(':').map(Number);
    const shiftStart = startHour * 100 + startMinute;
    const shiftEnd = endHour * 100 + endMinute;

    if (currentHourMinute < shiftStart) {
      return ShiftStatus.BEFORE_SHIFT;
    } else if (currentHourMinute >= shiftStart && currentHourMinute <= shiftEnd) {
      return ShiftStatus.DURING_SHIFT;
    } else {
      return ShiftStatus.AFTER_SHIFT;
    }
  }

  private async handleDuringShiftForceAttendance(
    userId: string,
    createdBy: string,
    targetDate: Date,
    currentTime: Date,
    checkInTime: string,
    reason: string,
    notes: string,
    shiftConfigs: any,
    configSettingId: string,
    entrySourceType: string,
    attendanceType: AttendanceType,
    timezone: string,
    entityManager: any,
  ) {
    if (!checkInTime) {
      throw new BadRequestException(ATTENDANCE_ERRORS.FORCE_ATTENDANCE_CHECK_IN_TIME_REQUIRED);
    }

    const checkInTimeUTC = this.utilityService.convertLocalTimeToUTC(
      checkInTime,
      timezone || shiftConfigs.timezone,
    );
    await this.validateTimeWithinShift(shiftConfigs, checkInTimeUTC, 'Check-in');

    await this.attendanceRepository.create(
      {
        userId,
        attendanceDate: targetDate,
        checkInTime: checkInTimeUTC,
        status: AttendanceStatus.CHECKED_IN,
        entrySourceType,
        attendanceType,
        approvalStatus: ApprovalStatus.APPROVED,
        notes,
        shiftConfigId: configSettingId,
        isActive: true,
        createdBy,
        approvalBy: createdBy,
        approvalAt: currentTime,
        approvalComment: DEFAULT_APPROVAL_COMMENT.FORCED,
      },
      entityManager,
    );

    return {
      message: ATTENDANCE_RESPONSES.FORCE_ATTENDANCE_SUCCESS,
      checkInTime: checkInTimeUTC,
    };
  }

  private async handleAfterShiftForceAttendance(
    userId: string,
    createdBy: string,
    targetDate: Date,
    currentTime: Date,
    checkInTime: string,
    checkOutTime: string,
    reason: string,
    notes: string,
    shiftConfigs: any,
    configSettingId: string,
    entrySourceType: string,
    attendanceType: AttendanceType,
    timezone: string,
    entityManager: any,
  ) {
    // After shift - both check-in and check-out are required
    if (!checkInTime || !checkOutTime) {
      throw new BadRequestException(ATTENDANCE_ERRORS.FORCE_ATTENDANCE_AFTER_SHIFT_BOTH_REQUIRED);
    }

    const checkInTimeUTC = this.utilityService.convertLocalTimeToUTC(
      checkInTime,
      timezone || shiftConfigs.timezone,
    );
    const checkOutTimeUTC = this.utilityService.convertLocalTimeToUTC(
      checkOutTime,
      timezone || shiftConfigs.timezone,
    );

    // Validate check-out is after check-in
    if (checkOutTimeUTC <= checkInTimeUTC) {
      throw new BadRequestException(ATTENDANCE_ERRORS.FORCE_ATTENDANCE_CHECK_OUT_BEFORE_CHECK_IN);
    }

    await this.validateTimeWithinShift(shiftConfigs, checkInTimeUTC, 'Check-in');
    await this.validateTimeWithinShift(shiftConfigs, checkOutTimeUTC, 'Check-out');

    await this.attendanceRepository.create(
      {
        userId,
        attendanceDate: targetDate,
        checkInTime: checkInTimeUTC,
        checkOutTime: checkOutTimeUTC,
        status: AttendanceStatus.PRESENT,
        entrySourceType,
        attendanceType,
        approvalStatus: ApprovalStatus.APPROVED,
        notes,
        shiftConfigId: configSettingId,
        isActive: true,
        createdBy,
        approvalBy: createdBy,
        approvalAt: currentTime,
        approvalComment: DEFAULT_APPROVAL_COMMENT.FORCED,
      },
      entityManager,
    );

    const workDurationSeconds = (checkOutTimeUTC.getTime() - checkInTimeUTC.getTime()) / 1000;

    return {
      message: ATTENDANCE_RESPONSES.FORCE_ATTENDANCE_SUCCESS,
      checkInTime: checkInTimeUTC,
      checkOutTime: checkOutTimeUTC,
      workDuration: workDurationSeconds,
    };
  }

  private async handlePreviousDayForceAttendance(
    userId: string,
    createdBy: string,
    targetDate: Date,
    checkInTime: string,
    checkOutTime: string,
    reason: string,
    notes: string,
    configSettingId: string,
    entrySourceType: string,
    attendanceType: AttendanceType,
    timezone: string,
    entityManager: any,
  ) {
    if (!checkInTime || !checkOutTime) {
      throw new BadRequestException(
        ATTENDANCE_ERRORS.FORCE_ATTENDANCE_BOTH_CHECK_IN_AND_CHECK_OUT_REQUIRED,
      );
    }

    const checkInTimeUTC = this.utilityService.convertLocalTimeToUTC(checkInTime, timezone);
    const checkOutTimeUTC = this.utilityService.convertLocalTimeToUTC(checkOutTime, timezone);

    // Validate check-out is after check-in
    if (checkOutTimeUTC <= checkInTimeUTC) {
      throw new BadRequestException(ATTENDANCE_ERRORS.FORCE_ATTENDANCE_CHECK_OUT_BEFORE_CHECK_IN);
    }

    const { shiftConfigs } = await this.getShiftConfigs();
    await this.validateTimeWithinShift(shiftConfigs, checkInTimeUTC, 'Check-in');
    await this.validateTimeWithinShift(shiftConfigs, checkOutTimeUTC, 'Check-out');

    const currentTime = new Date();

    await this.attendanceRepository.create(
      {
        userId,
        attendanceDate: targetDate,
        checkInTime: checkInTimeUTC,
        checkOutTime: checkOutTimeUTC,
        status: AttendanceStatus.PRESENT,
        entrySourceType,
        attendanceType,
        approvalStatus: ApprovalStatus.APPROVED, // Force attendance is pre-approved
        notes,
        shiftConfigId: configSettingId,
        isActive: true,
        createdBy,
        approvalBy: createdBy,
        approvalAt: currentTime,
        approvalComment: DEFAULT_APPROVAL_COMMENT.FORCED,
      },
      entityManager,
    );

    const workDurationSeconds = (checkOutTimeUTC.getTime() - checkInTimeUTC.getTime()) / 1000;

    return {
      message: ATTENDANCE_RESPONSES.FORCE_ATTENDANCE_SUCCESS,
      checkInTime: checkInTimeUTC,
      checkOutTime: checkOutTimeUTC,
      workDuration: workDurationSeconds,
    };
  }

  async getAttendanceRecords(queryDto: AttendanceQueryDto): Promise<AttendanceListResponseDto> {
    const { ...filters } = queryDto;

    const { query, countQuery, params, countParams } = buildAttendanceListQuery(filters);
    const { query: statsQuery, params: statsParams } = buildAttendanceStatsQuery(filters);

    const [records, [{ total }], stats] = await Promise.all([
      this.attendanceRepository.executeRawQuery(query, params),
      this.attendanceRepository.executeRawQuery(countQuery, countParams),
      this.attendanceRepository.executeRawQuery(statsQuery, statsParams),
    ]);

    return {
      stats: this.transformStatsResult(stats),
      records: records.map((record: any) => this.transformRawRecord(record)),
      totalRecords: parseInt(total),
    };
  }

  private transformRawRecord(record: any): AttendanceRecordDto {
    return {
      id: record.attendanceId,
      user: {
        id: record.userId,
        name: `${record.firstName} ${record.lastName}`.trim(),
        email: record.email,
        employeeId: '1234567890', // TODO: get employee id from user table
      },
      attendanceDate: record.attendanceDate,
      checkInTime: record.checkInTime,
      checkOutTime: record.checkOutTime,
      status: record.status,
      approvalStatus: record.approvalStatus,
      workDuration: this.calculateWorkDuration(record.checkInTime, record.checkOutTime),
      notes: record.notes,
    };
  }

  private calculateWorkDuration(checkIn?: Date, checkOut?: Date): number {
    if (!checkIn) return 0;

    // If no checkout time, use current time to calculate ongoing work duration
    const endTime = checkOut || new Date();

    const diffMs = endTime.getTime() - checkIn.getTime();
    return Math.floor(diffMs / 1000);
  }

  private transformStatsResult(statsResult: any[]): AttendanceStatsDto {
    const attendance: Record<string, number> = {};
    const approval: Record<string, number> = {};

    Object.values(AttendanceStatus).forEach((status) => {
      attendance[status] = 0;
    });
    Object.values(ApprovalStatus).forEach((status) => {
      approval[status] = 0;
    });

    let totalCount = 0;

    statsResult.forEach(
      ({
        count,
        status,
        approvalStatus,
      }: {
        count: string;
        status: AttendanceStatus;
        approvalStatus: ApprovalStatus;
      }) => {
        totalCount += parseInt(count);

        if (status) {
          attendance[status] = (attendance[status] || 0) + parseInt(count);
        }

        if (approvalStatus) {
          approval[approvalStatus] = (approval[approvalStatus] || 0) + parseInt(count);
        }
      },
    );

    attendance.total = totalCount;
    approval.total = totalCount;

    return { attendance, approval };
  }

  async getAttendanceHistory(attendanceHistoryDto: AttendanceHistoryDto) {
    try {
      const { date, userId } = attendanceHistoryDto;

      const attendance = await this.attendanceRepository.findAll({
        where: {
          userId,
          attendanceDate: new Date(date),
        },
      });

      return attendance;
    } catch (error) {
      throw error;
    }
  }

  async getEmployeeCurrentAttendanceStatus(userId: string) {
    try {
      const attendance = await this.attendanceRepository.findOne({
        where: {
          userId,
          isActive: true,
        },
      });
      return attendance;
    } catch (error) {
      throw error;
    }
  }

  async handleBulkAttendanceApproval({ approvals, approvedBy }: AttendanceBulkApprovalDto) {
    try {
      const result = [];
      const errors = [];

      for (const approval of approvals) {
        try {
          const attendance = await this.handleSingleAttendanceApproval(
            approval.attendanceId,
            approval,
            approvedBy,
          );
          result.push(attendance);
        } catch (error) {
          errors.push({
            attendanceId: approval.attendanceId,
            error: error.message,
          });
        }
      }
      return {
        message: ATTENDANCE_RESPONSES.ATTENDANCE_APPROVAL_PROCESSED.replace(
          '{length}',
          approvals.length.toString(),
        )
          .replace('{success}', result.length.toString())
          .replace('{error}', errors.length.toString()),
        result,
        errors,
      };
    } catch (error) {
      throw error;
    }
  }

  async handleSingleAttendanceApproval(
    attendanceId: string,
    approvalDto: AttendanceApprovalDto,
    approvedBy: string,
  ) {
    const { approvalStatus, approvalComment } = approvalDto;

    return await this.dataSource.transaction(async (entityManager) => {
      const attendance = await this.attendanceRepository.findOne(
        {
          where: { id: attendanceId, isActive: true },
          relations: ['user'],
        },
        entityManager,
      );

      if (!attendance) {
        throw new NotFoundException(ATTENDANCE_ERRORS.NOT_FOUND);
      }

      if (attendance.approvalStatus !== ApprovalStatus.PENDING) {
        throw new BadRequestException(
          ATTENDANCE_ERRORS.ATTENDANCE_APPROVAL_ALREADY_PROCESSED.replace(
            '{status}',
            attendance.approvalStatus,
          ),
        );
      }

      const currentTime = new Date();
      const updateAttendanceRecord: Partial<AttendanceEntity> = {
        approvalStatus,
        approvalBy: approvedBy,
        approvalAt: currentTime,
        approvalComment,
        updatedBy: approvedBy,
      };

      if (approvalStatus === ApprovalStatus.APPROVED) {
        updateAttendanceRecord.status = AttendanceStatus.PRESENT;
      }

      if (approvalStatus === ApprovalStatus.REJECTED) {
        updateAttendanceRecord.status = AttendanceStatus.ABSENT;
      }

      await this.attendanceRepository.update(
        { id: attendanceId },
        updateAttendanceRecord,
        entityManager,
      );

      return {
        message: ATTENDANCE_RESPONSES.ATTENDANCE_APPROVAL_SUCCESS.replace(
          '{status}',
          approvalStatus,
        ),
        attendanceId,
        newStatus: updateAttendanceRecord.status,
        approvalStatus,
      };
    });
  }
}
