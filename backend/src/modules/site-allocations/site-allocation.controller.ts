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
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SiteAllocationService } from './site-allocation.service';
import {
  CreateSiteAllocationDto,
  UpdateSiteAllocationDto,
  DeallocateSiteDto,
  GetSiteAllocationDto,
} from './dto';

@ApiTags('Site Allocations')
@ApiBearerAuth('JWT-auth')
@Controller('site-allocations')
export class SiteAllocationController {
  constructor(private readonly siteAllocationService: SiteAllocationService) {}

  @Post()
  async create(
    @Body() createDto: CreateSiteAllocationDto,
    @Request() { user: { id: userId } }: { user: { id: string } },
  ) {
    return this.siteAllocationService.create(createDto, userId);
  }

  @Get()
  async findAll(@Query() query: GetSiteAllocationDto) {
    return this.siteAllocationService.findAll(query);
  }

  @Get('user/:userId')
  async findByUserId(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.siteAllocationService.getAllocationsByUserId(userId);
  }

  @Get('user/:userId/current')
  async findCurrentByUserId(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.siteAllocationService.getCurrentAllocationByUserId(userId);
  }

  @Get('site/:siteId')
  async findBySiteId(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Query('onlyCurrent') onlyCurrent?: string,
  ) {
    const onlyCurrentAllocations = onlyCurrent === 'true';
    return this.siteAllocationService.getAllocationsBySiteId(siteId, onlyCurrentAllocations);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.siteAllocationService.findById(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateSiteAllocationDto,
    @Request() { user: { id: userId } }: { user: { id: string } },
  ) {
    return this.siteAllocationService.update(id, updateDto, userId);
  }

  @Patch(':id/deallocate')
  async deallocate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() deallocateDto: DeallocateSiteDto,
    @Request() { user: { id: userId } }: { user: { id: string } },
  ) {
    return this.siteAllocationService.deallocate(id, deallocateDto, userId);
  }
}
