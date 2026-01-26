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
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SiteService } from './site.service';
import { CreateSiteDto, UpdateSiteDto, GetSiteDto, UpdateSiteStatusDto } from './dto';

@ApiTags('Sites')
@ApiBearerAuth('JWT-auth')
@Controller('sites')
export class SiteController {
  constructor(private readonly siteService: SiteService) {}

  @Post()
  async create(
    @Request() { user: { id: createdBy } }: { user: { id: string } },
    @Body() createSiteDto: CreateSiteDto,
  ) {
    return await this.siteService.create(createSiteDto, createdBy);
  }

  @Get()
  async findAll(@Query() query: GetSiteDto) {
    return await this.siteService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.siteService.findById(id);
  }

  @Get(':id/contractors')
  async getContractors(@Param('id', ParseUUIDPipe) id: string) {
    return await this.siteService.getContractors(id);
  }

  @Get(':id/status-history')
  async getStatusHistory(@Param('id', ParseUUIDPipe) id: string) {
    return await this.siteService.getStatusHistory(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: updatedBy } }: { user: { id: string } },
    @Body() updateSiteDto: UpdateSiteDto,
  ) {
    return await this.siteService.update(id, updateSiteDto, updatedBy);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: updatedBy } }: { user: { id: string } },
    @Body() updateStatusDto: UpdateSiteStatusDto,
  ) {
    return await this.siteService.updateStatus(id, updateStatusDto, updatedBy);
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: deletedBy } }: { user: { id: string } },
  ) {
    return await this.siteService.remove(id, deletedBy);
  }

  @Post(':id/restore')
  async restore(@Param('id', ParseUUIDPipe) id: string) {
    return await this.siteService.restore(id);
  }
}
