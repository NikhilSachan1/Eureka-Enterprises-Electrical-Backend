import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  FindOneOptions,
  LessThanOrEqual,
  MoreThanOrEqual,
} from 'typeorm';
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
  ATTENDANCE_EMAIL_CONSTANTS,
  AttendanceStatus,
  AttendanceType,
  ApprovalStatus,
  AttendanceAction,
  DEFAULT_APPROVAL_COMMENT,
  ShiftStatus,
  AttendanceEntityFields,
  FOOD_EXPENSE_CONSTANTS,
  LEAVE_REGULARIZATION_CONSTANTS,
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
import { DataSuccessOperationType, SortOrder } from 'src/utils/utility/constants/utility.constants';
import { DateTimeService } from 'src/utils/datetime';
import { EmailService } from '../common/email/email.service';
import { WhatsAppService } from '../common/whatsapp/whatsapp.service';
import { UserService } from '../users/user.service';
import { SalaryStructureService } from '../salary-structures/salary-structure.service';
import { ExpenseTrackerService } from '../expense-tracker/expense-tracker.service';
import { LeaveApplicationsService } from '../leave-applications/leave-applications.service';
import { LeaveBalancesService } from '../leave-balances/leave-balances.service';
import {
  LeaveApplicationType,
  ApprovalStatus as LeaveApprovalStatus,
  LeaveType,
} from '../leave-applications/constants/leave-application.constants';
import { Environments } from 'env-configs';
import {
  EMAIL_SUBJECT,
  EMAIL_TEMPLATE,
  EMAIL_REDIRECT_ROUTES,
} from '../common/email/constants/email.constants';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private readonly attendanceRepository: AttendanceRepository,
    private readonly configurationService: ConfigurationService,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly utilityService: UtilityService,
    private readonly dateTimeService: DateTimeService,
    private readonly emailService: EmailService,
    private readonly whatsAppService: WhatsAppService,
    private readonly userService: UserService,
    @Inject(forwardRef(() => SalaryStructureService))
    private readonly salaryStructureService: SalaryStructureService,
    @Inject(forwardRef(() => ExpenseTrackerService))
    private readonly expenseTrackerService: ExpenseTrackerService,
    @Inject(forwardRef(() => LeaveApplicationsService))
    private readonly leaveApplicationsService: LeaveApplicationsService,
    @Inject(forwardRef(() => LeaveBalancesService))
    private readonly leaveBalancesService: LeaveBalancesService,
  ) {}

  async create(attendance: Partial<AttendanceEntity>, entityManager?: EntityManager) {
    try {
      return await this.attendanceRepository.create(attendance, entityManager);
    } catch (error) {
      throw error;
    }
  }

  async handleAttendanceAction(userId: string, attendanceActionDto: AttendanceActionDto) {
    const { action, entrySourceType, attendanceType, notes, timezone } = attendanceActionDto;
    const todayDate = this.dateTimeService.getStartOfToday(timezone);
    const currentTimeUTC = new Date();
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
            currentTimeUTC,
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
            currentTimeUTC,
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
      // Block check-in on leave days
      if (
        existingAttendance.status === AttendanceStatus.LEAVE ||
        existingAttendance.status === AttendanceStatus.LEAVE_WITHOUT_PAY
      ) {
        throw new BadRequestException(ATTENDANCE_ERRORS.CHECK_IN_NOT_ALLOWED_ON_LEAVE);
      }

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

      // UPDATE existing record if status is NOT_CHECKED_IN_YET or HOLIDAY
      if (
        existingAttendance.status === AttendanceStatus.NOT_CHECKED_IN_YET ||
        existingAttendance.status === AttendanceStatus.HOLIDAY
      ) {
        await this.attendanceRepository.update(
          { id: existingAttendance.id },
          {
            checkInTime: currentTime,
            status: AttendanceStatus.CHECKED_IN,
            entrySourceType,
            attendanceType,
            approvalStatus: ApprovalStatus.PENDING,
            notes,
            shiftConfigId: configSettingId,
            updatedBy: userId,
          },
          entityManager,
        );

        return {
          message: ATTENDANCE_RESPONSES.CHECK_IN_SUCCESS,
          checkInTime: currentTime,
        };
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
    regularizeAttendanceDto: RegularizeAttendanceDto & { timezone: string },
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
      leaveCategory,
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
    await this.isRegularizationAllowed({
      attendanceDate: existingAttendance.attendanceDate,
      timezone,
    });

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
            //crediting food expense here
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
            //crediting food expense here
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
            // Revert leave, credit back leave balance, and mark present
            await this.revertLeaveAndMarkPresent(
              userId,
              existingAttendance.attendanceDate,
              attendanceId,
              checkInTimeUTC,
              checkOutTimeUTC,
              notes,
              attendanceType,
              entrySourceType,
              existingAttendance.shiftConfigId,
              entityManager,
            );
          }
          if (existingAttendance.status === AttendanceStatus.HOLIDAY) {
            //Credited food expense and bonus leave will be credited with payroll generation
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
            //crediting food expense is done here
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
            //reverted food expense here
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
            //nothing to be done here.
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
            // Credit back leave and mark as absent
            await this.revertLeaveAndMarkAbsent(
              userId,
              existingAttendance.attendanceDate,
              attendanceId,
              notes,
              attendanceType,
              entrySourceType,
              existingAttendance.shiftConfigId,
              entityManager,
            );
          }
          if (existingAttendance.status === AttendanceStatus.HOLIDAY) {
            //Holiday to absent is not allowed for regularization
            throw new BadRequestException(
              ATTENDANCE_ERRORS.HOLIDAY_NOT_ALLOWED_AS_ABSENT_REGULARIZE,
            );
          }
          if (existingAttendance.status === AttendanceStatus.CHECKED_IN) {
            //Nothing to be done here for checked in to absent regularization
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
            // Force leave - debit leave balance and mark as leave
            await this.forceLeaveAndDebitBalance(
              userId,
              existingAttendance.attendanceDate,
              attendanceId,
              existingAttendance.status as AttendanceStatus,
              leaveCategory,
              notes,
              attendanceType,
              entrySourceType,
              existingAttendance.shiftConfigId,
              entityManager,
            );
          }
          if (existingAttendance.status === AttendanceStatus.HOLIDAY) {
            // Holiday to leave is not allowed for regularization
            throw new BadRequestException(
              ATTENDANCE_ERRORS.HOLIDAY_NOT_ALLOWED_AS_LEAVE_REGULARIZE,
            );
          }
          break;
        case AttendanceStatus.HOLIDAY:
          if (existingAttendance.status === AttendanceStatus.PRESENT) {
            //Reverted food expense here.

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
            //nothing to be done here
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

      // Handle food expense crediting/reversal based on status change
      await this.handleFoodExpenseForStatusChange(
        userId,
        existingAttendance.attendanceDate,
        existingAttendance.status as AttendanceStatus,
        status as AttendanceStatus,
        userId,
      );

      // Send regularization notification to the employee
      await this.sendRegularizationNotification(
        userId,
        userId, // regularizedBy is the same as userId in current implementation
        existingAttendance.attendanceDate,
        existingAttendance.status,
        status,
        checkInTimeUTC,
        checkOutTimeUTC,
        notes,
      );

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

  private async isRegularizationAllowed({
    attendanceDate,
    timezone,
  }: {
    attendanceDate: Date | string;
    timezone?: string;
  }) {
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

    // Use timezone-aware date comparison
    const attendanceDateStr =
      typeof attendanceDate === 'string'
        ? attendanceDate.split('T')[0]
        : this.dateTimeService.toDateString(new Date(attendanceDate));

    if (this.dateTimeService.isFutureDate(attendanceDateStr, timezone)) {
      throw new BadRequestException(ATTENDANCE_ERRORS.FUTURE_DATE_REGULARIZATION_NOT_ALLOWED);
    }

    if (this.dateTimeService.isPastDate(attendanceDateStr, timezone)) {
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

  async update(
    identifierConditions: FindOptionsWhere<AttendanceEntity>,
    updateData: Partial<AttendanceEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      await this.findOneOrFail({ where: identifierConditions });
      await this.attendanceRepository.update(identifierConditions, updateData, entityManager);
      return this.utilityService.getSuccessMessage(
        AttendanceEntityFields.ID,
        DataSuccessOperationType.UPDATE,
      );
    } catch (error) {
      throw error;
    }
  }

  async handleBulkForceAttendance(
    createdBy: string,
    bulkForceAttendanceDto: ForceAttendanceDto & { timezone: string },
  ): Promise<{ message: string }> {
    try {
      for (const userId of bulkForceAttendanceDto.userIds) {
        await this.handleSingleForceAttendance(createdBy, {
          ...bulkForceAttendanceDto,
          userId,
        });
      }
      return {
        message: ATTENDANCE_RESPONSES.FORCE_ATTENDANCE_SUCCESS,
      };
    } catch (error) {
      throw error;
    }
  }

  async handleSingleForceAttendance(
    createdBy: string,
    forceAttendanceDto: ForceAttendanceDto & { userId: string; timezone: string },
  ) {
    try {
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
        status,
      } = forceAttendanceDto;

      // Use timezone-aware date comparison
      const attendanceDateStr =
        typeof attendanceDate === 'string'
          ? attendanceDate.split('T')[0]
          : this.dateTimeService.toDateString(new Date(attendanceDate));

      // Use real UTC time for shift validation (shift configs are stored in UTC)
      const currentTimeUTC = new Date();
      const targetDateOnly = this.dateTimeService.toDate(attendanceDateStr);

      // Validate date is not in future (using user's timezone)
      if (this.dateTimeService.isFutureDate(attendanceDateStr, timezone)) {
        throw new BadRequestException(ATTENDANCE_ERRORS.FORCE_ATTENDANCE_FUTURE_DATE_NOT_ALLOWED);
      }

      const { configSettingId, shiftConfigs } = await this.getShiftConfigs();
      const isPreviousDay = this.dateTimeService.isPastDate(attendanceDateStr, timezone);
      const isSameDay = this.dateTimeService.isToday(attendanceDateStr, timezone);

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
            currentTimeUTC,
            checkInTime,
            checkOutTime,
            reason,
            status,
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
            status,
            notes,
            configSettingId,
            entrySourceType,
            attendanceType,
            timezone,
            entityManager,
          );
        }
      });
    } catch (error) {
      throw error;
    }
  }

  private async handleSameDayForceAttendance(
    userId: string,
    createdBy: string,
    targetDate: Date,
    currentTime: Date,
    checkInTime: string,
    checkOutTime: string,
    reason: string,
    status: AttendanceStatus,
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
          status,
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
          status,
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
    status: AttendanceStatus,
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
        status,
        entrySourceType,
        attendanceType,
        approvalStatus: ApprovalStatus.PENDING,
        notes: reason ? `${notes} | Reason: ${reason}` : notes,
        shiftConfigId: configSettingId,
        isActive: true,
        createdBy,
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
    status: AttendanceStatus,
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
        status,
        entrySourceType,
        attendanceType,
        approvalStatus: ApprovalStatus.APPROVED,
        notes,
        shiftConfigId: configSettingId,
        isActive: true,
        createdBy,
        approvalBy: createdBy,
        approvalAt: currentTime,
        approvalComment: reason || DEFAULT_APPROVAL_COMMENT.FORCED,
      },
      entityManager,
    );

    // Credit food expense for force attendance with APPROVED status and PRESENT status
    if (status === AttendanceStatus.PRESENT) {
      await this.handleFoodExpenseForStatusChange(
        userId,
        targetDate,
        AttendanceStatus.NOT_CHECKED_IN_YET, // Previous status (no attendance existed)
        status,
        createdBy,
      );
    }

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
    status: AttendanceStatus,
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
        status,
        entrySourceType,
        attendanceType,
        approvalStatus: ApprovalStatus.APPROVED, // Force attendance is pre-approved
        notes,
        shiftConfigId: configSettingId,
        isActive: true,
        createdBy,
        approvalBy: createdBy,
        approvalAt: currentTime,
        approvalComment: reason || DEFAULT_APPROVAL_COMMENT.FORCED,
      },
      entityManager,
    );

    // Credit food expense for force attendance with APPROVED status and PRESENT status
    if (status === AttendanceStatus.PRESENT) {
      await this.handleFoodExpenseForStatusChange(
        userId,
        targetDate,
        AttendanceStatus.NOT_CHECKED_IN_YET, // Previous status (no attendance existed)
        status,
        createdBy,
      );
    }

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
      user: record.userId
        ? {
            id: record.userId,
            firstName: record.firstName,
            lastName: record.lastName,
            email: record.email,
            employeeId: record.employeeId,
          }
        : null,
      createdBy: record.createdBy
        ? {
            id: record.createdBy,
            firstName: record.createdByFirstName,
            lastName: record.createdByLastName,
            email: record.createdByEmail,
            employeeId: record.createdByEmployeeId,
          }
        : null,
      approvalBy: record.approvalBy
        ? {
            id: record.approvalBy,
            firstName: record.approvalByFirstName,
            lastName: record.approvalByLastName,
            email: record.approvalByEmail,
            employeeId: record.approvalByEmployeeId,
          }
        : null,
      // Format attendanceDate to return only date without timestamp
      attendanceDate: record.attendanceDate
        ? new Date(record.attendanceDate).toISOString().split('T')[0]
        : record.attendanceDate,
      checkInTime: record.checkInTime,
      checkOutTime: record.checkOutTime,
      status: record.status,
      approvalStatus: record.approvalStatus,
      attendanceType: record.attendanceType,
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
        relations: ['user', 'approvalByUser', 'createdByUser', 'updatedByUser'],
        order: { createdAt: SortOrder.DESC },
        select: {
          user: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeId: true,
          },
          approvalByUser: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeId: true,
          },
          createdByUser: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeId: true,
          },
          updatedByUser: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeId: true,
          },
        },
      });

      return attendance.records.map((record) => {
        return {
          ...record,
          // User with standard fields (id, firstName, lastName, email, employeeId)
          user: record.user
            ? {
                id: record.user.id,
                firstName: record.user.firstName,
                lastName: record.user.lastName,
                email: record.user.email,
                employeeId: record.user.employeeId,
              }
            : undefined,
          approvalByUser: record.approvalByUser
            ? {
                id: record.approvalByUser.id,
                firstName: record.approvalByUser.firstName,
                lastName: record.approvalByUser.lastName,
                email: record.approvalByUser.email,
                employeeId: record.approvalByUser.employeeId,
              }
            : undefined,
          regularizedByUser: record.regularizedByUser
            ? {
                id: record.regularizedByUser.id,
                firstName: record.regularizedByUser.firstName,
                lastName: record.regularizedByUser.lastName,
                email: record.regularizedByUser.email,
                employeeId: record.regularizedByUser.employeeId,
              }
            : undefined,
          createdByUser: record.createdByUser
            ? {
                id: record.createdByUser.id,
                firstName: record.createdByUser.firstName,
                lastName: record.createdByUser.lastName,
                email: record.createdByUser.email,
                employeeId: record.createdByUser.employeeId,
              }
            : undefined,
          updatedByUser: record.updatedByUser
            ? {
                id: record.updatedByUser.id,
                firstName: record.updatedByUser.firstName,
                lastName: record.updatedByUser.lastName,
                email: record.updatedByUser.email,
                employeeId: record.updatedByUser.employeeId,
              }
            : undefined,
          workDuration: this.calculateWorkDuration(record.checkInTime, record.checkOutTime),
        };
      });
    } catch (error) {
      throw error;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getEmployeeCurrentAttendanceStatus(userId: string, _timezone?: string) {
    try {
      const attendance = await this.attendanceRepository.findOne({
        where: {
          userId,
          isActive: true,
        },
        relations: ['user'],
        select: {
          user: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeId: true,
          },
        },
      });
      return {
        id: attendance.id,
        checkInTime: attendance.checkInTime,
        checkOutTime: attendance.checkOutTime,
        status: attendance.status,
        approvalStatus: attendance.approvalStatus,
        workDuration: this.calculateWorkDuration(attendance.checkInTime, attendance.checkOutTime),
        location: 'Indore', //TODO: (SITE) get location dynamically
        clientName: 'Adani Plant', //TODO: (SITE) get client name dynamically
        user: {
          id: attendance.user.id,
          firstName: attendance.user.firstName,
          lastName: attendance.user.lastName,
          email: attendance.user.email,
          employeeId: attendance.user.employeeId,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  async handleBulkAttendanceApproval({ approvals, approvalBy }: AttendanceBulkApprovalDto) {
    try {
      const result = [];
      const errors = [];

      for (const approval of approvals) {
        try {
          const attendance = await this.handleSingleAttendanceApproval(
            approval.attendanceId,
            approval,
            approvalBy,
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
    approvalBy: string,
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

      if (attendance.approvalStatus === approvalStatus) {
        throw new BadRequestException(
          ATTENDANCE_ERRORS.ATTENDANCE_APPROVAL_ALREADY_PROCESSED.replace(
            '{status}',
            attendance.approvalStatus,
          ),
        );
      }

      // Store previous approval status for food expense handling
      const previousApprovalStatus = attendance.approvalStatus;

      const currentTime = new Date();
      const updateAttendanceRecord: Partial<AttendanceEntity> = {
        approvalStatus,
        approvalBy: approvalBy,
        approvalAt: currentTime,
        approvalComment,
        updatedBy: approvalBy,
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

      // Handle food expense crediting/reversal based on approval status
      await this.handleFoodExpenseForApproval(
        attendance,
        approvalStatus,
        previousApprovalStatus,
        approvalBy,
      );

      // Send approval notification (email + WhatsApp)
      this.sendAttendanceApprovalNotification(
        attendance,
        approvalBy,
        approvalStatus,
        approvalComment,
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

  private async sendAttendanceApprovalNotification(
    attendance: AttendanceEntity,
    approvalById: string,
    approvalStatus: string,
    approvalComment?: string,
  ) {
    try {
      const approver = await this.userService.findOne({ id: approvalById });
      const employee = attendance.user;

      if (!employee) return;

      const isApproved = approvalStatus === ApprovalStatus.APPROVED;
      const checkInTime = attendance.checkInTime ? this.formatTime(attendance.checkInTime) : 'N/A';
      const checkOutTime = attendance.checkOutTime
        ? this.formatTime(attendance.checkOutTime)
        : ATTENDANCE_EMAIL_CONSTANTS.NOT_APPLICABLE;

      // Calculate total hours
      let totalHours = ATTENDANCE_EMAIL_CONSTANTS.NOT_APPLICABLE;
      if (attendance.checkInTime && attendance.checkOutTime) {
        const diffMs =
          new Date(attendance.checkOutTime).getTime() - new Date(attendance.checkInTime).getTime();
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        totalHours = `${hours}h ${minutes}m`;
      }

      const dateStr = this.formatDateForEmail(attendance.attendanceDate);
      const approverName = approver
        ? `${approver.firstName} ${approver.lastName}`
        : ATTENDANCE_EMAIL_CONSTANTS.SYSTEM_USER;
      const employeeName = `${employee.firstName} ${employee.lastName}`;

      // Send Email notification
      if (employee.email) {
        const subjectKey = isApproved
          ? EMAIL_SUBJECT.ATTENDANCE_APPROVED
          : EMAIL_SUBJECT.ATTENDANCE_REJECTED;

        await this.emailService.sendMail({
          receiverEmails: employee.email,
          subject: subjectKey.replace('{date}', dateStr),
          template: EMAIL_TEMPLATE.ATTENDANCE_APPROVAL,
          emailData: {
            employeeName,
            isApproved,
            attendanceDate: dateStr,
            checkInTime,
            checkOutTime,
            totalHours,
            approverName,
            approvalDate: this.formatDateForEmail(new Date()),
            remarks: approvalComment,
            portalUrl: `${Environments.FE_BASE_URL}${EMAIL_REDIRECT_ROUTES.ATTENDANCE}`,
          },
        });
      }

      // Send WhatsApp notification (if user has opted in)
      const whatsappNumber = employee.whatsappNumber || employee.contactNumber;
      if (employee.whatsappOptIn && whatsappNumber) {
        await this.whatsAppService.sendAttendanceApproval(
          whatsappNumber,
          {
            employeeName,
            date: dateStr,
            approverName,
            remarks: approvalComment,
            isApproved,
          },
          {
            referenceId: attendance.id,
            recipientId: employee.id,
          },
        );
      }
    } catch (error) {
      // Log error but don't fail the approval process
      Logger.error('Failed to send attendance approval notification:', error);
    }
  }

  private formatDateForEmail(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  private formatTime(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  async sendRegularizationNotification(
    employeeId: string,
    regularizedById: string,
    attendanceDate: Date | string,
    originalStatus: string,
    newStatus: string,
    checkInTime?: Date,
    checkOutTime?: Date,
    notes?: string,
  ) {
    try {
      const employee = await this.userService.findOne({ id: employeeId });
      const regularizedBy = await this.userService.findOne({ id: regularizedById });

      if (!employee) return;

      const employeeName = `${employee.firstName} ${employee.lastName}`;
      const regularizedByName = regularizedBy
        ? `${regularizedBy.firstName} ${regularizedBy.lastName}`
        : ATTENDANCE_EMAIL_CONSTANTS.SYSTEM_USER;

      const dateStr = this.formatDateForEmail(attendanceDate);
      const checkInTimeStr = checkInTime ? this.formatTime(checkInTime) : null;
      const checkOutTimeStr = checkOutTime ? this.formatTime(checkOutTime) : null;

      // Calculate total hours
      let totalHours: string | null = null;
      if (checkInTime && checkOutTime) {
        const diffMs = new Date(checkOutTime).getTime() - new Date(checkInTime).getTime();
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        totalHours = `${hours}h ${minutes}m`;
      }

      // Send Email notification
      if (employee.email) {
        await this.emailService.sendMail({
          receiverEmails: employee.email,
          subject: EMAIL_SUBJECT.ATTENDANCE_REGULARIZED.replace('{date}', dateStr),
          template: EMAIL_TEMPLATE.ATTENDANCE_REGULARIZATION,
          emailData: {
            employeeName,
            attendanceDate: dateStr,
            originalStatus: originalStatus.toUpperCase().replace(/_/g, ' '),
            newStatus: newStatus.toUpperCase().replace(/_/g, ' '),
            checkInTime: checkInTimeStr,
            checkOutTime: checkOutTimeStr,
            totalHours,
            regularizedByName,
            regularizedOn: this.formatDateForEmail(new Date()),
            notes,
            portalUrl: `${Environments.FE_BASE_URL}${EMAIL_REDIRECT_ROUTES.ATTENDANCE}`,
          },
        });
      }

      // Send WhatsApp notification (if user has opted in)
      const whatsappNumber = employee.whatsappNumber || employee.contactNumber;
      if (employee.whatsappOptIn && whatsappNumber) {
        await this.whatsAppService.sendAttendanceRegularization(
          whatsappNumber,
          {
            employeeName,
            date: dateStr,
            originalStatus: originalStatus.toUpperCase().replace(/_/g, ' '),
            newStatus: newStatus.toUpperCase().replace(/_/g, ' '),
            regularizedByName,
            notes,
          },
          {
            referenceId: employeeId,
            recipientId: employee.id,
          },
        );
      }
    } catch (error) {
      Logger.error('Failed to send attendance regularization notification:', error);
    }
  }

  // ==================== Food Expense Handling ====================

  /**
   * Handle food expense crediting/reversal based on attendance approval
   * - On approval: Credit daily food allowance
   * - On rejection: If previously approved, reverse the credit
   */
  private async handleFoodExpenseForApproval(
    attendance: AttendanceEntity,
    newApprovalStatus: string,
    previousApprovalStatus: string,
    approvalBy: string,
  ): Promise<void> {
    try {
      const userId = attendance.userId;
      const attendanceDate = attendance.attendanceDate;
      const dateStr = this.dateTimeService.toDateString(attendanceDate);

      if (newApprovalStatus === ApprovalStatus.APPROVED) {
        // Credit food expense for approved attendance
        await this.creditFoodExpenseForAttendance(userId, attendanceDate, dateStr, approvalBy);
      } else if (
        newApprovalStatus === ApprovalStatus.REJECTED &&
        previousApprovalStatus === ApprovalStatus.APPROVED
      ) {
        // Reverse food expense if previously approved and now rejected
        await this.reverseFoodExpenseForAttendance(userId, attendanceDate, dateStr, approvalBy);
      }
    } catch (error) {
      // Log error but don't fail the approval process
      this.logger.error(
        `Failed to handle food expense for attendance ${attendance.id}: ${error.message}`,
      );
    }
  }

  /**
   * Handle food expense for regularization/force attendance status changes
   * - previousStatus PRESENT and newStatus not PRESENT: Reverse food credit
   * - previousStatus not PRESENT and newStatus PRESENT: Credit food
   */
  private async handleFoodExpenseForStatusChange(
    userId: string,
    attendanceDate: Date,
    previousStatus: AttendanceStatus,
    newStatus: AttendanceStatus,
    actionBy: string,
  ): Promise<void> {
    try {
      const dateStr = this.dateTimeService.toDateString(attendanceDate);
      const wasPresentBefore = previousStatus === AttendanceStatus.PRESENT;
      const isPresentNow = newStatus === AttendanceStatus.PRESENT;

      if (!wasPresentBefore && isPresentNow) {
        // Transitioning to PRESENT - credit food expense
        await this.creditFoodExpenseForAttendance(userId, attendanceDate, dateStr, actionBy);
      } else if (wasPresentBefore && !isPresentNow) {
        // Transitioning from PRESENT to something else - reverse food expense
        await this.reverseFoodExpenseForAttendance(userId, attendanceDate, dateStr, actionBy);
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle food expense for status change (${previousStatus} -> ${newStatus}): ${error.message}`,
      );
    }
  }

  /**
   * Credit food expense for an approved attendance
   * Calculates daily food allowance from salary and credits it
   */
  private async creditFoodExpenseForAttendance(
    userId: string,
    attendanceDate: Date,
    dateStr: string,
    approvalBy: string,
  ): Promise<void> {
    // Get user's active salary structure
    const salaryStructure = await this.getSalaryStructureForUser(userId);
    if (!salaryStructure || !salaryStructure.foodAllowance) {
      this.logger.warn(`No salary structure or food allowance found for user ${userId}`);
      return;
    }

    // Calculate daily food allowance
    const dailyFoodAllowance = this.calculateDailyFoodAllowance(
      Number(salaryStructure.foodAllowance),
      attendanceDate,
    );

    if (dailyFoodAllowance <= 0) {
      return;
    }

    // Credit food expense for attendance
    await this.expenseTrackerService.createSystemExpense({
      userId,
      category: FOOD_EXPENSE_CONSTANTS.CATEGORY,
      amount: dailyFoodAllowance,
      description: FOOD_EXPENSE_CONSTANTS.DESCRIPTION.replace('{date}', dateStr),
      createdBy: approvalBy,
      referenceId: FOOD_EXPENSE_CONSTANTS.REFERENCE_ID.replace('{userId}', userId).replace(
        '{date}',
        dateStr,
      ),
      referenceType: FOOD_EXPENSE_CONSTANTS.REFERENCE_TYPE,
    });

    this.logger.log(
      `Credited food expense ₹${dailyFoodAllowance} for user ${userId} on ${dateStr}`,
    );
  }

  /**
   * Reverse food expense when attendance is rejected after being approved
   * Creates a negative entry to reverse the credit
   */
  private async reverseFoodExpenseForAttendance(
    userId: string,
    attendanceDate: Date,
    dateStr: string,
    approvalBy: string,
  ): Promise<void> {
    // Get user's active salary structure
    const salaryStructure = await this.getSalaryStructureForUser(userId);
    if (!salaryStructure || !salaryStructure.foodAllowance) {
      return;
    }

    // Calculate daily food allowance
    const dailyFoodAllowance = this.calculateDailyFoodAllowance(
      Number(salaryStructure.foodAllowance),
      attendanceDate,
    );

    if (dailyFoodAllowance <= 0) {
      return;
    }

    // Reverse food expense (create negative credit entry)
    await this.expenseTrackerService.createSystemExpense({
      userId,
      category: FOOD_EXPENSE_CONSTANTS.CATEGORY,
      amount: -dailyFoodAllowance, // Negative amount for reversal
      description: FOOD_EXPENSE_CONSTANTS.REVERSAL_DESCRIPTION.replace('{date}', dateStr),
      createdBy: approvalBy,
      referenceId: FOOD_EXPENSE_CONSTANTS.REVERSAL_REFERENCE_ID.replace('{userId}', userId).replace(
        '{date}',
        dateStr,
      ),
      referenceType: FOOD_EXPENSE_CONSTANTS.REFERENCE_TYPE,
    });

    this.logger.log(
      `Reversed food expense ₹${dailyFoodAllowance} for user ${userId} on ${dateStr}`,
    );
  }

  private async getSalaryStructureForUser(userId: string) {
    try {
      return await this.salaryStructureService.findActiveByUserId(userId);
    } catch {
      return null;
    }
  }

  private calculateDailyFoodAllowance(monthlyFoodAllowance: number, date: Date): number {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dailyAmount = monthlyFoodAllowance / daysInMonth;
    return Math.round(dailyAmount * 100) / 100;
  }

  /**
   * Revert leave, credit back leave balance, and mark attendance as present
   * Used when regularizing from LEAVE to PRESENT status
   */
  private async revertLeaveAndMarkPresent(
    userId: string,
    attendanceDate: Date,
    attendanceId: string,
    checkInTimeUTC: Date,
    checkOutTimeUTC: Date,
    notes: string,
    attendanceType: string,
    entrySourceType: string,
    shiftConfigId: string,
    entityManager: EntityManager,
  ): Promise<void> {
    // Find the leave application for this date
    const leaveApplication = await this.findLeaveApplicationForDate(userId, attendanceDate);

    if (leaveApplication) {
      const financialYear = this.utilityService.getFinancialYear(attendanceDate);

      // Credit back 1 day to leave balance (decrement consumed)
      await this.leaveBalancesService.update(
        {
          userId,
          leaveCategory: leaveApplication.leaveCategory,
          financialYear,
        },
        { consumed: () => 'GREATEST(0, consumed::int - 1)::varchar' } as any,
        entityManager,
      );

      this.logger.log(
        `Credited back 1 day of ${
          leaveApplication.leaveCategory
        } leave for user ${userId} on ${this.dateTimeService.toDateString(attendanceDate)}`,
      );

      // If it's a single-day leave, update the leave application status
      const fromDate = new Date(leaveApplication.fromDate);
      const toDate = new Date(leaveApplication.toDate);
      const isSingleDayLeave = fromDate.toDateString() === toDate.toDateString();

      if (isSingleDayLeave) {
        const dateStr = this.dateTimeService.toDateString(attendanceDate);
        // Cancel the entire leave application
        await this.leaveApplicationsService.update(
          { id: leaveApplication.id },
          {
            approvalStatus: LeaveApprovalStatus.CANCELLED,
            approvalReason: LEAVE_REGULARIZATION_CONSTANTS.LEAVE_CANCELLED_REASON_PRESENT.replace(
              '{date}',
              dateStr,
            ),
            approvalBy: userId,
            approvalAt: new Date(),
            updatedBy: userId,
          },
          entityManager,
        );
        this.logger.log(`Cancelled single-day leave application ${leaveApplication.id}`);
      } else {
        // For multi-day leave, just log (we still credited back 1 day)
        this.logger.log(
          `Multi-day leave application ${leaveApplication.id} - credited back 1 day but leave application not cancelled`,
        );
      }
    } else {
      this.logger.warn(
        `No leave application found for user ${userId} on ${this.dateTimeService.toDateString(
          attendanceDate,
        )}`,
      );
    }

    // Deactivate old attendance record
    await this.attendanceRepository.update(
      { id: attendanceId },
      {
        isActive: false,
        updatedBy: userId,
      },
      entityManager,
    );

    // Create new attendance record as PRESENT
    const dateStr = this.dateTimeService.toDateString(attendanceDate);
    await this.attendanceRepository.create(
      {
        userId,
        attendanceDate,
        checkInTime: checkInTimeUTC,
        checkOutTime: checkOutTimeUTC,
        status: AttendanceStatus.PRESENT,
        notes:
          notes ||
          LEAVE_REGULARIZATION_CONSTANTS.REGULARIZATION_NOTES_PRESENT.replace('{date}', dateStr),
        attendanceType,
        entrySourceType,
        approvalStatus: ApprovalStatus.APPROVED,
        approvalBy: userId,
        approvalAt: new Date(),
        approvalComment: DEFAULT_APPROVAL_COMMENT.PRESENT,
        regularizedBy: userId,
        shiftConfigId,
        isActive: true,
        createdBy: userId,
        updatedBy: userId,
      },
      entityManager,
    );
  }

  /**
   * Revert leave, credit back leave balance, and mark attendance as absent
   * Used when regularizing from LEAVE to ABSENT status
   */
  private async revertLeaveAndMarkAbsent(
    userId: string,
    attendanceDate: Date,
    attendanceId: string,
    notes: string,
    attendanceType: string,
    entrySourceType: string,
    shiftConfigId: string,
    entityManager: EntityManager,
  ): Promise<void> {
    // Find the leave application for this date
    const leaveApplication = await this.findLeaveApplicationForDate(userId, attendanceDate);

    if (leaveApplication) {
      const financialYear = this.utilityService.getFinancialYear(attendanceDate);
      const dateStr = this.dateTimeService.toDateString(attendanceDate);

      // Credit back 1 day to leave balance (decrement consumed)
      await this.leaveBalancesService.update(
        {
          userId,
          leaveCategory: leaveApplication.leaveCategory,
          financialYear,
        },
        { consumed: () => 'GREATEST(0, consumed::int - 1)::varchar' } as any,
        entityManager,
      );

      this.logger.log(
        `Credited back 1 day of ${leaveApplication.leaveCategory} leave for user ${userId} on ${dateStr}`,
      );

      // If it's a single-day leave, update the leave application status
      const fromDate = new Date(leaveApplication.fromDate);
      const toDate = new Date(leaveApplication.toDate);
      const isSingleDayLeave = fromDate.toDateString() === toDate.toDateString();

      if (isSingleDayLeave) {
        // Cancel the entire leave application
        await this.leaveApplicationsService.update(
          { id: leaveApplication.id },
          {
            approvalStatus: LeaveApprovalStatus.CANCELLED,
            approvalReason: LEAVE_REGULARIZATION_CONSTANTS.LEAVE_CANCELLED_REASON_ABSENT.replace(
              '{date}',
              dateStr,
            ),
            approvalBy: userId,
            approvalAt: new Date(),
            updatedBy: userId,
          },
          entityManager,
        );
        this.logger.log(`Cancelled single-day leave application ${leaveApplication.id}`);
      } else {
        this.logger.log(
          `Multi-day leave application ${leaveApplication.id} - credited back 1 day but leave application not cancelled`,
        );
      }
    } else {
      this.logger.warn(
        `No leave application found for user ${userId} on ${this.dateTimeService.toDateString(
          attendanceDate,
        )}`,
      );
    }

    // Deactivate old attendance record
    await this.attendanceRepository.update(
      { id: attendanceId },
      {
        isActive: false,
        updatedBy: userId,
      },
      entityManager,
    );

    // Create new attendance record as ABSENT
    const dateStr = this.dateTimeService.toDateString(attendanceDate);
    await this.attendanceRepository.create(
      {
        userId,
        attendanceDate,
        status: AttendanceStatus.ABSENT,
        notes:
          notes ||
          LEAVE_REGULARIZATION_CONSTANTS.REGULARIZATION_NOTES_ABSENT.replace('{date}', dateStr),
        attendanceType,
        entrySourceType,
        approvalStatus: ApprovalStatus.APPROVED,
        approvalBy: userId,
        approvalAt: new Date(),
        approvalComment: DEFAULT_APPROVAL_COMMENT.ABSENT,
        regularizedBy: userId,
        shiftConfigId,
        isActive: true,
        createdBy: userId,
        updatedBy: userId,
      },
      entityManager,
    );
  }

  /**
   * Force leave - debit leave balance and mark attendance as leave
   * Used when regularizing to LEAVE status from other statuses
   */
  private async forceLeaveAndDebitBalance(
    userId: string,
    attendanceDate: Date,
    attendanceId: string,
    previousStatus: AttendanceStatus,
    leaveCategory: string,
    notes: string,
    attendanceType: string,
    entrySourceType: string,
    shiftConfigId: string,
    entityManager: EntityManager,
  ): Promise<void> {
    const dateStr = this.dateTimeService.toDateString(attendanceDate);
    const financialYear = this.utilityService.getFinancialYear(attendanceDate);

    // Check if user has leave balance for this category
    const leaveBalance = await this.leaveBalancesService.findOne({
      where: {
        userId,
        leaveCategory,
        financialYear,
      },
    });

    if (!leaveBalance) {
      throw new BadRequestException(
        `No leave balance found for category "${leaveCategory}" in financial year ${financialYear}`,
      );
    }

    const availableBalance =
      parseFloat(leaveBalance.totalAllocated) - parseFloat(leaveBalance.consumed);
    if (availableBalance < 1) {
      throw new BadRequestException(
        `Insufficient leave balance for "${leaveCategory}". Available: ${availableBalance} days`,
      );
    }

    // Debit 1 day from leave balance (increment consumed)
    await this.leaveBalancesService.update(
      {
        userId,
        leaveCategory,
        financialYear,
      },
      { consumed: () => '(consumed::int + 1)::varchar' } as any,
      entityManager,
    );

    this.logger.log(`Debited 1 day of ${leaveCategory} leave for user ${userId} on ${dateStr}`);

    // Create a forced leave application record
    await this.leaveApplicationsService.create(
      {
        userId,
        leaveConfigId: leaveBalance.leaveConfigId,
        leaveType: LeaveType.FULL_DAY,
        leaveCategory,
        entrySourceType,
        leaveApplicationType: LeaveApplicationType.FORCED,
        fromDate: attendanceDate,
        toDate: attendanceDate,
        reason: LEAVE_REGULARIZATION_CONSTANTS.FORCE_LEAVE_REASON.replace('{date}', dateStr),
        approvalStatus: LeaveApprovalStatus.APPROVED,
        approvalBy: userId,
        approvalAt: new Date(),
        approvalReason: LEAVE_REGULARIZATION_CONSTANTS.FORCE_LEAVE_REASON.replace(
          '{date}',
          dateStr,
        ),
        createdBy: userId,
      },
      entityManager,
    );

    // If previous status was PRESENT, reverse food expense
    if (previousStatus === AttendanceStatus.PRESENT) {
      await this.reverseFoodExpenseForAttendance(userId, attendanceDate, dateStr, userId);
      this.logger.log(`Reversed food expense for user ${userId} on ${dateStr} (was PRESENT)`);
    }

    // Deactivate old attendance record
    await this.attendanceRepository.update(
      { id: attendanceId },
      {
        isActive: false,
        updatedBy: userId,
      },
      entityManager,
    );

    // Create new attendance record as LEAVE
    await this.attendanceRepository.create(
      {
        userId,
        attendanceDate,
        status: AttendanceStatus.LEAVE,
        notes: notes || LEAVE_REGULARIZATION_CONSTANTS.FORCE_LEAVE_NOTES.replace('{date}', dateStr),
        attendanceType,
        entrySourceType,
        approvalStatus: ApprovalStatus.APPROVED,
        approvalBy: userId,
        approvalAt: new Date(),
        approvalComment: DEFAULT_APPROVAL_COMMENT.LEAVE,
        regularizedBy: userId,
        shiftConfigId,
        isActive: true,
        createdBy: userId,
        updatedBy: userId,
      },
      entityManager,
    );
  }

  private async findLeaveApplicationForDate(userId: string, date: Date): Promise<any | null> {
    try {
      // Find approved leave application where the date falls between fromDate and toDate
      const leaveApplication = await this.leaveApplicationsService.findOne({
        where: {
          userId,
          approvalStatus: LeaveApprovalStatus.APPROVED,
          fromDate: LessThanOrEqual(date),
          toDate: MoreThanOrEqual(date),
        },
      });

      return leaveApplication;
    } catch (error) {
      this.logger.error(`Error finding leave application for date: ${error.message}`);
      return null;
    }
  }
}
