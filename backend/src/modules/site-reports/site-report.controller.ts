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
import { CreateSiteReportDto, UpdateSiteReportDto, GetSiteReportDto } from './dto';

@ApiTags('Site Reports')
@ApiBearerAuth('JWT-auth')
@Controller('site-reports')
export class SiteReportController {
  constructor(private readonly reportService: SiteReportService) {}

  @Post()
  @RequiredPermission('financials.site-reports.create')
  @ApiOperation({ summary: 'Create a Report against an APPROVED JMC (auto-approved)' })
  async create(
    @Request() { user: { id: createdBy } }: { user: { id: string } },
    @Body() dto: CreateSiteReportDto,
  ) {
    return await this.reportService.create(dto, createdBy);
  }

  @Get()
  @RequiredPermission('financials.site-reports.view')
  async findAll(@Query() query: GetSiteReportDto) {
    return await this.reportService.findAll(query);
  }

  @Get(':id')
  @RequiredPermission('financials.site-reports.view')
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
    return await this.reportService.update(id, dto, updatedBy);
  }

  @Delete(':id')
  @RequiredPermission('financials.site-reports.delete')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: deletedBy } }: { user: { id: string } },
  ) {
    return await this.reportService.remove(id, deletedBy);
  }
}
