import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SiteAllocationService } from './site-allocation.service';
import {
  CreateSiteAllocationDto,
  UpdateSiteAllocationDto,
  DeallocateSiteDto,
  GetSiteAllocationDto,
  ManageSiteAllocationDto,
} from './dto';

@ApiTags('Site Allocations')
@ApiBearerAuth('JWT-auth')
@Controller('site-allocations')
export class SiteAllocationController {
  constructor(private readonly siteAllocationService: SiteAllocationService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new site allocation',
    description:
      'Creates a new allocation of a user to a site with start date and optional end date.',
  })
  async create(
    @Body() createDto: CreateSiteAllocationDto,
    @Request() { user: { id: userId } }: { user: { id: string } },
  ) {
    return this.siteAllocationService.create(createDto, userId);
  }

  @Post('manage')
  @ApiOperation({
    summary: 'Manage site allocation (allocate/deallocate)',
    description:
      'Unified API for site allocation management. Use action: "allocate" to assign a user to a site, or action: "deallocate" to end an allocation.',
  })
  async manage(
    @Body() manageDto: ManageSiteAllocationDto,
    @Request() { user: { id: userId } }: { user: { id: string } },
  ) {
    return this.siteAllocationService.manage(manageDto, userId);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all site allocations',
    description:
      'Retrieves a list of all site allocations with optional filtering, pagination, and sorting based on query parameters.',
  })
  async findAll(@Query() query: GetSiteAllocationDto) {
    return this.siteAllocationService.findAll(query);
  }

  @Get('user/:userId')
  @ApiOperation({
    summary: 'Get allocations by user ID',
    description:
      'Retrieves all site allocations for a specific user, including both current and historical allocations.',
  })
  async findByUserId(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.siteAllocationService.getAllocationsByUserId(userId);
  }

  @Get('user/:userId/current')
  @ApiOperation({
    summary: 'Get current allocation by user ID',
    description: 'Retrieves the currently active site allocation for a specific user.',
  })
  async findCurrentByUserId(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.siteAllocationService.getCurrentAllocationByUserId(userId);
  }

  @Get('site/:siteId')
  @ApiOperation({
    summary: 'Get allocations by site ID',
    description:
      'Retrieves all site allocations for a specific site. Use the onlyCurrent query parameter to filter for only active allocations.',
  })
  async findBySiteId(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Query('onlyCurrent') onlyCurrent?: string,
  ) {
    const onlyCurrentAllocations = onlyCurrent === 'true';
    return this.siteAllocationService.getAllocationsBySiteId(siteId, onlyCurrentAllocations);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a site allocation by ID',
    description:
      'Retrieves detailed information about a specific site allocation by its unique identifier.',
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.siteAllocationService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a site allocation',
    description:
      'Updates the details of an existing site allocation. Only provided fields will be updated.',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateSiteAllocationDto,
    @Request() { user: { id: userId } }: { user: { id: string } },
  ) {
    return this.siteAllocationService.update(id, updateDto, userId);
  }

  @Patch(':id/deallocate')
  @ApiOperation({
    summary: 'Deallocate a site',
    description:
      'Deallocates a user from a site by setting an end date. This effectively ends the allocation.',
  })
  async deallocate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() deallocateDto: DeallocateSiteDto,
    @Request() { user: { id: userId } }: { user: { id: string } },
  ) {
    return this.siteAllocationService.deallocate(id, deallocateDto, userId);
  }
}
