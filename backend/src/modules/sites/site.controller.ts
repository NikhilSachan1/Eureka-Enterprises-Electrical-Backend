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
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody } from '@nestjs/swagger';
import { SiteService } from './site.service';
import {
  CreateSiteDto,
  UpdateSiteDto,
  GetSiteDto,
  GetSiteActivityDto,
  UpdateSiteStatusDto,
  BulkDeleteSiteDto,
} from './dto';

@ApiTags('Sites')
@ApiBearerAuth('JWT-auth')
@Controller('sites')
export class SiteController {
  constructor(private readonly siteService: SiteService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new site',
    description:
      'Creates a new site with the provided details including company, manager, and contractor information.',
  })
  async create(
    @Request() { user: { id: createdBy } }: { user: { id: string } },
    @Body() createSiteDto: CreateSiteDto,
  ) {
    return await this.siteService.create(createSiteDto, createdBy);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all sites — employees see only their allocated sites',
    description:
      'Retrieves a list of all sites with optional filtering, pagination, and sorting based on query parameters.',
  })
  async findAll(
    @Query() query: GetSiteDto,
    @Request() req: { user: { id: string; activeRole: string } },
  ) {
    return await this.siteService.findAll(query, req.user.id, req.user.activeRole);
  }

  @Get('activity')
  @ApiOperation({
    summary: 'Site activity report',
    description:
      'Returns site details, linked contractors, linked vendors, and full employee allocation/deallocation history. ' +
      'Filterable by site name/ID, company, contractor, vendor, and employee name. No siteId required — use filters.',
  })
  async getSiteActivity(@Query() query: GetSiteActivityDto) {
    return await this.siteService.getSiteActivity(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a site by ID',
    description: 'Retrieves detailed information about a specific site by its unique identifier.',
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.siteService.findById(id);
  }

  @Get(':id/contractors')
  @ApiOperation({
    summary: 'Get contractors for a site',
    description: 'Retrieves all contractors associated with a specific site.',
  })
  async getContractors(@Param('id', ParseUUIDPipe) id: string) {
    return await this.siteService.getContractors(id);
  }

  @Get(':id/status-history')
  @ApiOperation({
    summary: 'Get site status history',
    description:
      'Retrieves the complete status change history for a specific site, showing all status transitions over time.',
  })
  async getStatusHistory(@Param('id', ParseUUIDPipe) id: string) {
    return await this.siteService.getStatusHistory(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a site',
    description: 'Updates the details of an existing site. Only provided fields will be updated.',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: updatedBy } }: { user: { id: string } },
    @Body() updateSiteDto: UpdateSiteDto,
  ) {
    return await this.siteService.update(id, updateSiteDto, updatedBy);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Update site status',
    description: 'Updates the status of a site and records the status change in the site history.',
  })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: updatedBy } }: { user: { id: string } },
    @Body() updateStatusDto: UpdateSiteStatusDto,
  ) {
    return await this.siteService.updateStatus(id, updateStatusDto, updatedBy);
  }

  @Delete()
  @ApiOperation({
    summary: 'Bulk delete sites',
    description: 'Soft deletes multiple sites in bulk based on the provided site IDs.',
  })
  @ApiBody({ type: BulkDeleteSiteDto })
  async bulkDelete(
    @Request() { user: { id: deletedBy } }: { user: { id: string } },
    @Body() bulkDeleteDto: BulkDeleteSiteDto,
  ) {
    return await this.siteService.bulkDelete(bulkDeleteDto.siteIds, deletedBy);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a site',
    description:
      'Soft deletes a site by marking it as deleted. The site can be restored later if needed.',
  })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: deletedBy } }: { user: { id: string } },
  ) {
    return await this.siteService.remove(id, deletedBy);
  }

  @Post(':id/restore')
  @ApiOperation({
    summary: 'Restore a deleted site',
    description: 'Restores a previously soft-deleted site, making it active again.',
  })
  async restore(@Param('id', ParseUUIDPipe) id: string) {
    return await this.siteService.restore(id);
  }

  @Get(':id/overview')
  @ApiOperation({
    summary: 'Site overview',
    description:
      'Returns site details (including work types), all allocated and deallocated employees, linked contractors, and linked vendors — all in a single call.',
  })
  async getOverview(@Param('id', ParseUUIDPipe) id: string) {
    return await this.siteService.getOverview(id);
  }
}
