import { Controller, Post, Body, Request } from '@nestjs/common';
import { LeaveApplicationsService } from './leave-applications.service';
import { CreateLeaveApplicationDto } from './dto/create-leave-application.dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';

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
      userId,
    });
  }
}
