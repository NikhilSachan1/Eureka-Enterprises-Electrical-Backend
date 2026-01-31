import { Controller, Get, Param, Query, Post, Body } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CronLogService } from './cron-log.service';
import { CronLogQueryDto } from './dto';

@ApiTags('Cron Logs')
@ApiBearerAuth('JWT-auth')
@Controller('cron-logs')
export class CronLogController {
  constructor(private readonly cronLogService: CronLogService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all cron logs',
    description: 'Retrieves a paginated list of cron job execution logs with optional filtering.',
  })
  findAll(@Query() query: CronLogQueryDto) {
    return this.cronLogService.findAll(query);
  }

  @Get('failures')
  @ApiOperation({ summary: 'Get recent failed cron jobs' })
  @ApiQuery({ name: 'hours', required: false, description: 'Hours to look back (default: 24)' })
  getRecentFailures(@Query('hours') hours?: number) {
    return this.cronLogService.getRecentFailures(hours || 24);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get cron log by ID',
    description: 'Retrieves detailed information about a specific cron job execution log.',
  })
  findOne(@Param('id') id: string) {
    return this.cronLogService.findOneOrFail(id);
  }

  @Post('cleanup')
  @ApiOperation({
    summary: 'Cleanup old cron logs',
    description: 'Deletes cron logs older than the specified retention period (in days).',
  })
  async cleanup(@Body() body: { retentionDays?: number }) {
    return await this.cronLogService.cleanup(body.retentionDays);
  }
}
