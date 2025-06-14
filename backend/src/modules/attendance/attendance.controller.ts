import { Controller, Post, Body, Request, Param } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceActionDto, ForceAttendanceDto, RegularizeAttendanceDto } from './dto';
import { DetectSource } from './decorators';
import { AttendanceType, EntrySourceType } from './constants/attendance.constants';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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
    // @Request() { user: { id: createdBy } }: { user: { id: string } },
    @Body() forceAttendanceDto: ForceAttendanceDto,
    @DetectSource() sourceType: EntrySourceType,
  ) {
    return this.attendanceService.forceAttendance('123e4567-e89b-12d3-a456-426614174000', {
      ...forceAttendanceDto,
      entrySourceType: sourceType,
      attendanceType: AttendanceType.FORCED,
    });
  }
}
