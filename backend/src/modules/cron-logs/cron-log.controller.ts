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
  findOne(@Param('id') id: string) {
    return this.cronLogService.findOneOrFail(id);
  }

  @Post('cleanup')
  async cleanup(@Body() body: { retentionDays?: number }) {
    return await this.cronLogService.cleanup(body.retentionDays);
  }
}
