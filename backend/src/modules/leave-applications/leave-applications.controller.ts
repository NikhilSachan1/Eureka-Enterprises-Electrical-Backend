import { Controller, Post, Body, Request } from '@nestjs/common';
import { LeaveApplicationsService } from './leave-applications.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { CreateLeaveApplicationDto, ForceLeaveApplicationDto } from './dto';
import { LeaveApplicationType } from './constants/leave-application.constants';

@ApiTags('Leave')
@ApiBearerAuth('JWT-auth')
@Controller('leave')
export class LeaveApplicationsController {
  constructor(private readonly leaveApplicationsService: LeaveApplicationsService) {}

  @Public()
  @Post('apply')
  applyLeave(
    @Request() { user: { id: userId } }: { user: { id: string } },
    @Body() createLeaveApplicationDto: CreateLeaveApplicationDto,
  ) {
    return this.leaveApplicationsService.applyLeave({
      ...createLeaveApplicationDto,
      leaveApplicationType: LeaveApplicationType.SELF,
      userId,
      createdBy: userId,
    });
  }

  @Post('force')
  async forceAttendance(
    @Request() { user: { id: createdBy } }: { user: { id: string } },
    @Body() forceLeaveApplicationDto: ForceLeaveApplicationDto,
  ) {
    return this.leaveApplicationsService.forceLeaveApplication({
      ...forceLeaveApplicationDto,
      leaveApplicationType: LeaveApplicationType.FORCED,
      userId: createdBy,
      createdBy,
    });
  }
}
