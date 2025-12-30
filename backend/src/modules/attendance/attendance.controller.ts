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
import { ApiBearerAuth, ApiTags, ApiResponse } from '@nestjs/swagger';
import { AttendanceUserInterceptor } from './interceptors/attendance-user.interceptor';
import { AttendanceHistoryUserInterceptor } from './interceptors/attendance-history-user.interceptor';
import { RequestWithTimezone } from './attendance.types';
@ApiTags('Attendance')
@ApiBearerAuth('JWT-auth')
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('action')
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
  @ApiResponse({ status: 200, type: AttendanceListResponseDto })
  async getAttendanceRecords(
    @Query() attendanceQueryDto: AttendanceQueryDto,
  ): Promise<AttendanceListResponseDto> {
    return this.attendanceService.getAttendanceRecords(attendanceQueryDto);
  }

  @Get('history')
  @UseInterceptors(AttendanceHistoryUserInterceptor)
  async getAttendanceHistory(@Query() attendanceHistoryDto: AttendanceHistoryDto) {
    return this.attendanceService.getAttendanceHistory(attendanceHistoryDto);
  }

  @Get('current-status')
  async getEmployeeCurrentAttendanceStatus(@Request() req: RequestWithTimezone) {
    return this.attendanceService.getEmployeeCurrentAttendanceStatus(req.user.id, req.timezone);
  }

  @Post('approval')
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
