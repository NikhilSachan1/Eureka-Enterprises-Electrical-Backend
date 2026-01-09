import { Controller, Post, Get, Body, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { CronTriggerService } from './cron-trigger.service';
import { TriggerCronDto, TriggerCronResponseDto, ListCronJobsResponseDto } from './dto';

@ApiTags('Admin - Cron Trigger')
@ApiBearerAuth('JWT-auth')
@Controller('admin/cron')
export class CronTriggerController {
  constructor(private readonly cronTriggerService: CronTriggerService) {}

  @Get('jobs')
  @ApiOperation({
    summary: 'List all available cron jobs',
    description:
      'Returns all cron jobs that can be manually triggered with their descriptions, required parameters, and dependencies',
  })
  @ApiResponse({
    status: 200,
    description: 'List of available cron jobs',
    type: ListCronJobsResponseDto,
  })
  listAvailableJobs() {
    return this.cronTriggerService.listAvailableJobs();
  }

  @Post('trigger')
  @ApiOperation({
    summary: 'Manually trigger a cron job',
    description: `
      Triggers a cron job manually with validations.
      
      **Validations:**
      - Checks if required parameters are provided based on job type
      - Validates that dependency jobs have been executed (can be skipped)
      - Checks if job is already running
      - Checks if job was already processed for the period (can be forced)
      
      **Options:**
      - \`dryRun\`: Preview what would be affected without making changes
      - \`skipDependencyCheck\`: Skip dependency validation (use with caution)
      - \`forceRun\`: Force run even if already processed
      
      **Examples:**
      - Payroll: \`{ "jobName": "MONTHLY_PAYROLL_GENERATION", "month": 12, "year": 2025 }\`
      - Attendance: \`{ "jobName": "DAILY_ATTENDANCE_ENTRY", "date": "2025-01-09" }\`
      - Alerts: \`{ "jobName": "CARD_EXPIRY_ALERT" }\`
    `,
  })
  @ApiBody({ type: TriggerCronDto })
  @ApiResponse({
    status: 200,
    description: 'Job triggered successfully',
    type: TriggerCronResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid parameters or validation failed',
  })
  @ApiResponse({
    status: 409,
    description: 'Job already running or already processed',
  })
  async triggerJob(
    @Request() { user: { id: triggeredBy } }: { user: { id: string } },
    @Body() dto: TriggerCronDto,
  ): Promise<TriggerCronResponseDto> {
    return this.cronTriggerService.triggerJob(dto, triggeredBy);
  }
}
