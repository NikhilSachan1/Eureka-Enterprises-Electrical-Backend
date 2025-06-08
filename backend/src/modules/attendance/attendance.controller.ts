import { Controller, Post, Body, Request, Param } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceActionDto } from './dto';
import { DetectSource } from './decorators';
import { AttendanceType, EntrySourceType } from './constants/attendance.constants';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RegularizeAttendanceDto } from './dto/regularization.dto';

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
}
