import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RequiredPermission } from 'src/modules/auth/decorators/required-permission.decorator';
import { SiteReportService } from './site-report.service';
import { DocumentNotifierService } from 'src/modules/notifications/document-notifier.service';
import { CreateSiteReportDto, UpdateSiteReportDto, GetSiteReportDto } from './dto';
import { UnlockRequestDto } from 'src/modules/purchase-orders/dto/approval.dto';

@ApiTags('Site Reports')
@ApiBearerAuth('JWT-auth')
@Controller('site-reports')
export class SiteReportController {
  constructor(
    private readonly reportService: SiteReportService,
    private readonly docs: DocumentNotifierService,
  ) {}

  @Patch(':id/approve')
  @RequiredPermission('financials.site-reports.approve')
  @ApiOperation({ summary: 'Approve a pending site report' })
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: approvedBy } }: { user: { id: string } },
  ) {
    const result = await this.reportService.approve(id, approvedBy);
    this.docs.notify('REPORT', 'APPROVED', id, approvedBy);
    return result;
  }

  @Patch(':id/reject')
  @RequiredPermission('financials.site-reports.approve')
  @ApiOperation({ summary: 'Reject a pending site report' })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: rejectedBy } }: { user: { id: string } },
  ) {
    const result = await this.reportService.reject(id, rejectedBy);
    this.docs.notify('REPORT', 'REJECTED', id, rejectedBy);
    return result;
  }

  @Post()
  @RequiredPermission('financials.site-reports.create')
  @ApiOperation({ summary: 'Create a Report against an APPROVED JMC' })
  async create(
    @Request() { user: { id: createdBy } }: { user: { id: string } },
    @Body() dto: CreateSiteReportDto,
  ) {
    const result = await this.reportService.create(dto, createdBy);
    this.docs.notify('REPORT', 'ADDED', result?.id, createdBy);
    return result;
  }

  @Get()
  @RequiredPermission('financials.site-reports.view-list')
  async findAll(@Query() query: GetSiteReportDto) {
    return await this.reportService.findAll(query);
  }

  @Get(':id')
  @RequiredPermission('financials.site-reports.view-list')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.reportService.findById(id);
  }

  @Patch(':id')
  @RequiredPermission('financials.site-reports.update')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: updatedBy } }: { user: { id: string } },
    @Body() dto: UpdateSiteReportDto,
  ) {
    const result = await this.reportService.update(id, dto, updatedBy);
    this.docs.notify('REPORT', 'EDITED', id, updatedBy);
    return result;
  }

  @Delete(':id')
  @RequiredPermission('financials.site-reports.delete')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: deletedBy } }: { user: { id: string } },
  ) {
    const before = await this.docs.snapshot('REPORT', id);
    const result = await this.reportService.remove(id, deletedBy);
    this.docs.notify('REPORT', 'DELETED', before, deletedBy);
    return result;
  }

  @Post(':id/unlock-request')
  @RequiredPermission('financials.site-reports.update')
  @ApiOperation({ summary: 'Request unlock for an approved+locked site report' })
  async requestUnlock(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: requestedBy } }: { user: { id: string } },
    @Body() dto: UnlockRequestDto,
  ) {
    const result = await this.reportService.requestUnlock(id, dto, requestedBy);
    this.docs.notify('REPORT', 'UNLOCK_REQUESTED', id, requestedBy, dto.reason);
    return result;
  }

  @Post(':id/unlock-grant')
  @RequiredPermission('financials.site-reports.unlock')
  @ApiOperation({ summary: 'Grant unlock request — admin (report becomes editable)' })
  async grantUnlock(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: grantedBy } }: { user: { id: string } },
  ) {
    const before = await this.docs.snapshot('REPORT', id);
    const result = await this.reportService.grantUnlock(id, grantedBy);
    this.docs.notify('REPORT', 'UNLOCK_GRANTED', before, grantedBy);
    return result;
  }

  @Post(':id/unlock-reject')
  @RequiredPermission('financials.site-reports.unlock')
  @ApiOperation({ summary: 'Reject unlock request — admin (report stays locked)' })
  async rejectUnlock(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: rejectedBy } }: { user: { id: string } },
  ) {
    const before = await this.docs.snapshot('REPORT', id);
    const result = await this.reportService.rejectUnlock(id, rejectedBy);
    this.docs.notify('REPORT', 'UNLOCK_REJECTED', before, rejectedBy);
    return result;
  }
}
