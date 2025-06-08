import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, FindOneOptions } from 'typeorm';
import { AttendanceRepository } from './attendance.repository';
import { AttendanceActionDto } from './dto';
import {
  ATTENDANCE_ERRORS,
  ATTENDANCE_RESPONSES,
  AttendanceStatus,
  AttendanceType,
  ApprovalStatus,
  AttendanceAction,
  DEFAULT_APPROVAL_COMMENT,
} from './constants/attendance.constants';
import { ConfigurationService } from '../configurations/configuration.service';
import {
  CONFIGURATION_KEYS,
  CONFIGURATION_MODULES,
} from '../../utils/master-constants/master-constants';
import { AttendanceEntity } from './entities/attendance.entity';
import { RegularizeAttendanceDto } from './dto/regularization.dto';
import { UtilityService } from '../../utils/utility/utility.service';

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
        shiftConfigs.timezone,
      );
      const checkOutTimeUTC = this.utilityService.convertLocalTimeToUTC(
        checkOutTime,
        shiftConfigs.timezone,
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
}
