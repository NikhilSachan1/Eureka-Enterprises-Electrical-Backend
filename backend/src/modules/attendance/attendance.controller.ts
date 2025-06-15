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
import { AttendanceType, EntrySourceType } from './constants/attendance.constants';
import { ApiBearerAuth, ApiTags, ApiResponse } from '@nestjs/swagger';
import { AttendanceUserInterceptor } from './interceptors/attendance-user.interceptor';
import { AttendanceHistoryUserInterceptor } from './interceptors/attendance-history-user.interceptor';

@ApiTags('Attendance')
@ApiBearerAuth('JWT-auth')
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('action')
  async handleAttendanceAction(
    @Request() { user: { id: userId } }: { user: { id: string } },
    @Body() attendanceActionDto: AttendanceActionDto,
    @DetectSource() sourceType: EntrySourceType,
  ) {
    return this.attendanceService.handleAttendanceAction(userId, {
      ...attendanceActionDto,
      entrySourceType: sourceType,
      attendanceType: AttendanceType.SELF,
    });
  }

  @Post(':attendanceId/regularize')
  async regularizeAttendance(
    @Param('attendanceId') attendanceId: string,
    @Body() regularizeAttendanceDto: RegularizeAttendanceDto,
    @DetectSource() sourceType: EntrySourceType,
  ) {
    return this.attendanceService.regularizeAttendance(attendanceId, {
      ...regularizeAttendanceDto,
      entrySourceType: sourceType,
      attendanceType: AttendanceType.REGULARIZED,
    });
  }

  @Post('force')
  async forceAttendance(
    @Request() { user: { id: createdBy } }: { user: { id: string } },
    @Body() forceAttendanceDto: ForceAttendanceDto,
    @DetectSource() sourceType: EntrySourceType,
  ) {
    return this.attendanceService.forceAttendance(createdBy, {
      ...forceAttendanceDto,
      entrySourceType: sourceType,
      attendanceType: AttendanceType.FORCED,
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
  async getEmployeeCurrentAttendanceStatus(
    @Request() { user: { id: userId } }: { user: { id: string } },
  ) {
    return this.attendanceService.getEmployeeCurrentAttendanceStatus(userId);
  }

  @Post('approval')
  async attendanceApproval(
    @Request() { user: { id: approvedBy } }: { user: { id: string } },
    @Body() attendanceApprovalDto: AttendanceBulkApprovalDto,
  ) {
    return this.attendanceService.handleBulkAttendanceApproval({
      ...attendanceApprovalDto,
      approvedBy,
    });
  }
}
