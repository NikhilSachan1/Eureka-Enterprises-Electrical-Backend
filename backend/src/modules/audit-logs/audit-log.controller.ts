import { Controller, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuditLogService } from './audit-log.service';
import {
  //   RequestAuditLogQueryDto,
  //   EntityAuditLogQueryDto,
  CleanupAuditLogsDto,
} from './dto/audit-log-query.dto';

@ApiTags('Audit Logs')
@ApiBearerAuth('JWT-auth')
@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  //INFO: Below endpoints and services are not required as of now but can be used in future.

  //   @Get('requests')
  //   @ApiOperation({ summary: 'Get all request audit logs with filters' })
  //   @ApiResponse({ status: 200, description: 'Returns paginated request audit logs with stats' })
  //   findAllRequestLogs(@Query() query: RequestAuditLogQueryDto) {
  //     return this.auditLogService.findAllRequestLogs(query);
  //   }

  //   @Get('requests/:id')
  //   @ApiOperation({ summary: 'Get a specific request audit log' })
  //   @ApiResponse({ status: 200, description: 'Returns the request audit log' })
  //   @ApiResponse({ status: 404, description: 'Audit log not found' })
  //   findOneRequestLog(@Param('id', ParseUUIDPipe) id: string) {
  //     return this.auditLogService.findOneRequestLog(id);
  //   }

  //   @Get('requests/correlation/:correlationId')
  //   @ApiOperation({ summary: 'Get all request logs by correlation ID' })
  //   @ApiResponse({ status: 200, description: 'Returns all request logs for a correlation' })
  //   findRequestLogsByCorrelation(@Param('correlationId', ParseUUIDPipe) correlationId: string) {
  //     return this.auditLogService.findRequestLogsByCorrelation(correlationId);
  //   }

  //   @Get('entities')
  //   @ApiOperation({ summary: 'Get all entity audit logs with filters' })
  //   @ApiResponse({ status: 200, description: 'Returns paginated entity audit logs with stats' })
  //   findAllEntityLogs(@Query() query: EntityAuditLogQueryDto) {
  //     return this.auditLogService.findAllEntityLogs(query);
  //   }

  //   @Get('entities/:id')
  //   @ApiOperation({ summary: 'Get a specific entity audit log' })
  //   @ApiResponse({ status: 200, description: 'Returns the entity audit log' })
  //   @ApiResponse({ status: 404, description: 'Audit log not found' })
  //   findOneEntityLog(@Param('id', ParseUUIDPipe) id: string) {
  //     return this.auditLogService.findOneEntityLog(id);
  //   }

  //   @Get('entities/history/:entityName/:entityId')
  //   @ApiOperation({ summary: 'Get full history of changes for a specific entity' })
  //   @ApiResponse({ status: 200, description: 'Returns the complete change history for an entity' })
  //   getEntityHistory(
  //     @Param('entityName') entityName: string,
  //     @Param('entityId', ParseUUIDPipe) entityId: string,
  //   ) {
  //     return this.auditLogService.getEntityHistory(entityName, entityId);
  //   }

  //   @Get('stats')
  //   @ApiOperation({ summary: 'Get audit log statistics' })
  //   @ApiResponse({ status: 200, description: 'Returns audit statistics' })
  //   getStats() {
  //     return this.auditLogService.getStats();
  //   }

  @Delete('cleanup')
  @ApiOperation({ summary: 'Delete audit logs older than specified days' })
  @ApiResponse({ status: 200, description: 'Returns cleanup results' })
  cleanup(@Query() query: CleanupAuditLogsDto) {
    return this.auditLogService.cleanup(query);
  }
}
