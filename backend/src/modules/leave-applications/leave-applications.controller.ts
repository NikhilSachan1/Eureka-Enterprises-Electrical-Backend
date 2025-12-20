import { Controller, Post, Body, Request, UseInterceptors, Get, Query } from '@nestjs/common';
import { LeaveApplicationsService } from './leave-applications.service';
import { ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import {
  CreateLeaveApplicationDto,
  ForceLeaveApplicationDto,
  GetLeaveApplicationsDto,
  LeaveApplicationListResponseDto,
  GroupedLeaveApplicationListResponseDto,
  LeaveBulkApprovalDto,
} from './dto';
import { LeaveApplicationType } from './constants/leave-application.constants';
import { EntrySourceType } from 'src/utils/master-constants/master-constants';
import { DetectSource } from '../attendance/decorators/source-detector.decorator';
import { LeaveUserInterceptor } from './interceptors/leave-user.interceptor';

@ApiTags('Leave')
@ApiBearerAuth('JWT-auth')
@Controller('leave')
export class LeaveApplicationsController {
  constructor(private readonly leaveApplicationsService: LeaveApplicationsService) {}

  @Post('apply')
  applyLeave(
    @Request() { user: { id: userId } }: { user: { id: string } },
    @Body() createLeaveApplicationDto: CreateLeaveApplicationDto,
    @DetectSource() sourceType: EntrySourceType,
  ) {
    return this.leaveApplicationsService.applyLeave({
      ...createLeaveApplicationDto,
      leaveApplicationType: LeaveApplicationType.SELF,
      userId,
      createdBy: userId,
      entrySourceType: sourceType,
    });
  }

  @Post('force')
  async forceLeaveApplication(
    @Request() { user: { id: createdBy } }: { user: { id: string } },
    @Body() forceLeaveApplicationDto: ForceLeaveApplicationDto,
    @DetectSource() sourceType: EntrySourceType,
  ) {
    return this.leaveApplicationsService.forceLeaveApplication({
      ...forceLeaveApplicationDto,
      leaveApplicationType: LeaveApplicationType.FORCED,
      createdBy,
      entrySourceType: sourceType,
    });
  }

  @Get()
  @UseInterceptors(LeaveUserInterceptor)
  @ApiResponse({
    status: 200,
    description:
      'Returns grouped or flat leave applications based on "grouped" query param. Default is grouped=true.',
    schema: {
      oneOf: [
        { $ref: '#/components/schemas/GroupedLeaveApplicationListResponseDto' },
        { $ref: '#/components/schemas/LeaveApplicationListResponseDto' },
      ],
    },
  })
  async getLeaveApplications(
    @Query() filters: GetLeaveApplicationsDto,
  ): Promise<LeaveApplicationListResponseDto | GroupedLeaveApplicationListResponseDto> {
    return this.leaveApplicationsService.getLeaveApplications(filters);
  }

  @Post('approval')
  async leaveApproval(
    @Request() { user: { id: approvalBy } }: { user: { id: string } },
    @Body() leaveBulkApprovalDto: LeaveBulkApprovalDto,
  ) {
    return this.leaveApplicationsService.handleBulkLeaveApplicationApproval({
      ...leaveBulkApprovalDto,
      approvalBy,
    });
  }
}
