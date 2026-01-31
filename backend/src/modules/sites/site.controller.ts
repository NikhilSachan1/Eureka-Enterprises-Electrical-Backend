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
import { SiteService } from './site.service';
import { CreateSiteDto, UpdateSiteDto, GetSiteDto, UpdateSiteStatusDto } from './dto';

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
    summary: 'Get all sites',
    description:
      'Retrieves a list of all sites with optional filtering, pagination, and sorting based on query parameters.',
  })
  async findAll(@Query() query: GetSiteDto) {
    return await this.siteService.findAll(query);
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
}
