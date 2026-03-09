import {
  Controller,
  Post,
  Body,
  Request,
  Param,
  Get,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import {
  AttendanceActionDto,
  ForceAttendanceDto,
  RegularizeAttendanceDto,
  AttendanceQueryDto,
  AttendanceListResponseDto,
  AttendanceBulkApprovalDto,
  AttendanceHistoryDto,
} from './dto';
import { DetectSource } from './decorators';
import { AttendanceType } from './constants/attendance.constants';
import { EntrySourceType } from 'src/utils/master-constants/master-constants';
import { ApiBearerAuth, ApiTags, ApiResponse, ApiOperation } from '@nestjs/swagger';
import { AttendanceUserInterceptor } from './interceptors/attendance-user.interceptor';
import { AttendanceHistoryUserInterceptor } from './interceptors/attendance-history-user.interceptor';
import { AttendanceCurrentStatusInterceptor } from './interceptors/attendance-current-status.interceptor';
import { CurrentStatusQueryDto } from './dto/current-status-query.dto';
import { RequestWithTimezone } from './attendance.types';
@ApiTags('Attendance')
@ApiBearerAuth('JWT-auth')
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('action')
  @ApiOperation({
    summary: 'Mark attendance',
    description: 'Marks attendance for an employee with clock-in/clock-out action.',
  })
  async handleAttendanceAction(
    @Request() req: RequestWithTimezone,
    @Body() attendanceActionDto: AttendanceActionDto,
    @DetectSource() sourceType: EntrySourceType,
  ) {
    return this.attendanceService.handleAttendanceAction(req.user.id, {
      ...attendanceActionDto,
      entrySourceType: sourceType,
      attendanceType: AttendanceType.SELF,
      timezone: req.timezone,
    });
  }

  @Post(':attendanceId/regularize')
  @ApiOperation({
    summary: 'Regularize attendance',
    description: 'Regularizes an existing attendance record with corrected time entries.',
  })
  async regularizeAttendance(
    @Request() req: RequestWithTimezone,
    @Param('attendanceId') attendanceId: string,
    @Body() regularizeAttendanceDto: RegularizeAttendanceDto,
    @DetectSource() sourceType: EntrySourceType,
  ) {
    return this.attendanceService.regularizeAttendance(attendanceId, {
      ...regularizeAttendanceDto,
      entrySourceType: sourceType,
      attendanceType: AttendanceType.REGULARIZED,
      timezone: req.timezone,
    });
  }

  @Post('force')
  @ApiOperation({
    summary: 'Force attendance',
    description: 'Forces attendance entries for multiple employees in bulk.',
  })
  async handleBulkForceAttendance(
    @Request() req: RequestWithTimezone,
    @Body() forceAttendanceDto: ForceAttendanceDto,
    @DetectSource() sourceType: EntrySourceType,
  ) {
    return this.attendanceService.handleBulkForceAttendance(req.user.id, {
      ...forceAttendanceDto,
      entrySourceType: sourceType,
      attendanceType: AttendanceType.FORCED,
      timezone: req.timezone,
    });
  }

  @Get()
  @UseInterceptors(AttendanceUserInterceptor)
  @ApiOperation({
    summary: 'Get attendance records',
    description: 'Retrieves a list of attendance records based on query filters.',
  })
  @ApiResponse({ status: 200, type: AttendanceListResponseDto })
  async getAttendanceRecords(
    @Query() attendanceQueryDto: AttendanceQueryDto,
  ): Promise<AttendanceListResponseDto> {
    return this.attendanceService.getAttendanceRecords(attendanceQueryDto);
  }

  @Get('history')
  @UseInterceptors(AttendanceHistoryUserInterceptor)
  @ApiOperation({
    summary: 'Get attendance history',
    description: 'Retrieves historical attendance records for an employee.',
  })
  async getAttendanceHistory(@Query() attendanceHistoryDto: AttendanceHistoryDto) {
    return this.attendanceService.getAttendanceHistory(attendanceHistoryDto);
  }

  @Get('current-status')
  @UseInterceptors(AttendanceCurrentStatusInterceptor)
  @ApiOperation({
    summary: 'Get current attendance status',
    description:
      'Retrieves the current attendance status (clocked-in/clocked-out) for the authenticated employee or a specified user (HR/ADMIN/SUPER_ADMIN only).',
  })
  async getEmployeeCurrentAttendanceStatus(
    @Query() query: CurrentStatusQueryDto,
    @Request() req: RequestWithTimezone,
  ) {
    return this.attendanceService.getEmployeeCurrentAttendanceStatus(query.userId, req.timezone);
  }

  @Post('approval')
  @ApiOperation({
    summary: 'Approve attendance',
    description: 'Approves or rejects attendance records in bulk.',
  })
  async attendanceApproval(
    @Request() { user: { id: approvalBy } }: { user: { id: string } },
    @Body() attendanceApprovalDto: AttendanceBulkApprovalDto,
  ) {
    return this.attendanceService.handleBulkAttendanceApproval({
      ...attendanceApprovalDto,
      approvalBy,
    });
  }
}
