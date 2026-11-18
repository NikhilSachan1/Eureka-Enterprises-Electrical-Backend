import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SiteAllocationService } from './site-allocation.service';
import {
  UpdateSiteAllocationDto,
  GetSiteAllocationDto,
  GetEmployeeOverviewDto,
  ManageSiteAllocationDto,
  GetAllocationSummaryDto,
} from './dto';
import { RequiredAnyPermission } from 'src/modules/auth/decorators/required-permission.decorator';

@ApiTags('Site Allocations')
@ApiBearerAuth('JWT-auth')
@Controller('site-allocations')
export class SiteAllocationController {
  constructor(private readonly siteAllocationService: SiteAllocationService) {}

  @RequiredAnyPermission('project.allocate-deallocate-employee')
  @Post('manage')
  @ApiOperation({
    summary: 'Manage site allocations (bulk allocate & deallocate)',
    description:
      'Unified API for site allocation management. Supports both allocations and deallocations in a single request. Each allocation/deallocation can have different parameters (dates, roles, allowances). Pass "allocations" array for new allocations and "deallocations" array for ending allocations. Returns detailed results with success/failure counts for each operation.',
  })
  async manage(
    @Body() manageDto: ManageSiteAllocationDto,
    @Request() { user: { id: userId } }: { user: { id: string } },
  ) {
    return this.siteAllocationService.manage(manageDto, userId);
  }

  @RequiredAnyPermission('project.allocation-history.view-list')
  @Get()
  @ApiOperation({
    summary: 'Get all site allocations',
    description:
      'Retrieves a list of all site allocations with optional filtering, pagination, and sorting based on query parameters.',
  })
  async findAll(
    @Request() { user: { id: userId, activeRole } }: { user: { id: string; activeRole?: string } },
    @Query() query: GetSiteAllocationDto,
  ) {
    return this.siteAllocationService.findAll(query, userId, activeRole);
  }

  @RequiredAnyPermission('project.allocation-history.view-list')
  @Get('summary/employees')
  @ApiOperation({
    summary: 'Allocation summary per employee',
    description:
      'One row per employee with an allocation in scope (site, period, search): where they are now, how many projects and days. Paged on the server.',
  })
  async getEmployeeSummary(
    @Request() { user: { id: userId, activeRole } }: { user: { id: string; activeRole?: string } },
    @Query() query: GetAllocationSummaryDto,
  ) {
    return this.siteAllocationService.getEmployeeSummary(query, userId, activeRole);
  }

  @RequiredAnyPermission('project.allocation-history.view-list')
  @Get('summary/projects')
  @ApiOperation({
    summary: 'Allocation summary per project',
    description:
      'One row per project with an allocation in scope (site, period, search): people on it now and in total, first allocation and last change. Paged on the server.',
  })
  async getProjectSummary(
    @Request() { user: { id: userId, activeRole } }: { user: { id: string; activeRole?: string } },
    @Query() query: GetAllocationSummaryDto,
  ) {
    return this.siteAllocationService.getProjectSummary(query, userId, activeRole);
  }

  @RequiredAnyPermission('project.workforce-allocation.view-list')
  @Get('employees')
  @ApiOperation({
    summary: 'Employee allocation overview (Free/Allocated) with stats',
    description:
      'All active employees with their designation, current project (site → company → parent company), ' +
      'Free/Allocated status and since-date. Includes global stats (total/allocated/free). ' +
      'Filters: allocatedStatus, search (name/code), siteId/siteName; paginated.',
  })
  async employeeOverview(@Query() query: GetEmployeeOverviewDto) {
    return this.siteAllocationService.getEmployeeOverview(query);
  }

  @RequiredAnyPermission(
    'project.workforce-allocation.view-list',
    'project.allocation-history.view-list',
  )
  @Get('user/:userId')
  @ApiOperation({
    summary: 'Get allocations by user ID',
    description:
      'Retrieves all site allocations for a specific user, including both current and historical allocations.',
  })
  async findByUserId(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.siteAllocationService.getAllocationsByUserId(userId);
  }

  @RequiredAnyPermission(
    'project.workforce-allocation.view-list',
    'project.allocation-history.view-list',
  )
  @Get('user/:userId/current')
  @ApiOperation({
    summary: 'Get current allocation by user ID',
    description: 'Retrieves the currently active site allocation for a specific user.',
  })
  async findCurrentByUserId(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.siteAllocationService.getCurrentAllocationByUserId(userId);
  }

  @RequiredAnyPermission(
    'project.workforce-allocation.view-list',
    'project.allocation-history.view-list',
  )
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

  @RequiredAnyPermission(
    'project.workforce-allocation.view-list',
    'project.allocation-history.view-list',
  )
  @Get(':id')
  @ApiOperation({
    summary: 'Get a site allocation by ID',
    description:
      'Retrieves detailed information about a specific site allocation by its unique identifier.',
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.siteAllocationService.findById(id);
  }

  @RequiredAnyPermission('project.allocate-deallocate-employee')
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

  @RequiredAnyPermission('project.allocate-deallocate-employee')
  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a site allocation that should never have existed',
    description:
      'For a mistake, not a transfer. De-allocating asks for an end date, and closing a wrong ' +
      'allocation on its own start date still records the employee as having been on that site ' +
      'that day; this leaves nothing behind. Refused outright when payroll has been generated for ' +
      'a month it covers. Refused once, with the count, when attendance exists inside its dates — ' +
      'send confirm=true to go ahead.',
  })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('confirm') confirm: string,
    @Request() { user: { id: userId } }: { user: { id: string } },
  ) {
    return this.siteAllocationService.remove(id, userId, confirm === 'true');
  }
}
