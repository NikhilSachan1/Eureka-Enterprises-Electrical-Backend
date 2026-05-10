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
import { JmcService } from './jmc.service';
import { CreateJmcDto, UpdateJmcDto, GetJmcDto } from './dto';
import {
  ApproveDto,
  RejectDto,
  UnlockRequestDto,
} from 'src/modules/purchase-orders/dto/approval.dto';

@ApiTags('JMCs')
@ApiBearerAuth('JWT-auth')
@Controller('jmcs')
export class JmcController {
  constructor(private readonly jmcService: JmcService) {}

  @Post()
  @RequiredPermission('financials.jmcs.create')
  @ApiOperation({ summary: 'Create a JMC against an APPROVED PO' })
  async create(
    @Request() { user: { id: createdBy } }: { user: { id: string } },
    @Body() dto: CreateJmcDto,
  ) {
    return await this.jmcService.create(dto, createdBy);
  }

  @Get('dropdown')
  @RequiredPermission('financials.jmcs.view')
  @ApiOperation({
    summary: 'JMC dropdown for Report or Invoice creation',
    description:
      'Returns JMCs for a site+partyType with per-item eligibility flags. ' +
      'Use forDocument=report when building the JMC dropdown for Report creation; ' +
      'use forDocument=invoice when building the JMC dropdown for Invoice creation. ' +
      'Ineligible items include the reason so the UI can show a tooltip.',
  })
  async getDropdown(
    @Query('siteId') siteId: string,
    @Query('partyType') partyType: string,
    @Query('forDocument') forDocument: 'report' | 'invoice',
  ) {
    return await this.jmcService.getDropdown(siteId, partyType, forDocument);
  }

  @Get()
  @RequiredPermission('financials.jmcs.view')
  @ApiOperation({ summary: 'List JMCs' })
  async findAll(@Query() query: GetJmcDto) {
    return await this.jmcService.findAll(query);
  }

  @Get(':id')
  @RequiredPermission('financials.jmcs.view')
  @ApiOperation({ summary: 'Get a JMC by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.jmcService.findById(id);
  }

  @Patch(':id')
  @RequiredPermission('financials.jmcs.update')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: updatedBy } }: { user: { id: string } },
    @Body() dto: UpdateJmcDto,
  ) {
    return await this.jmcService.update(id, dto, updatedBy);
  }

  @Delete(':id')
  @RequiredPermission('financials.jmcs.delete')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: deletedBy } }: { user: { id: string } },
  ) {
    return await this.jmcService.remove(id, deletedBy);
  }

  @Post(':id/approve')
  @RequiredPermission('financials.jmcs.approve')
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: approvedBy } }: { user: { id: string } },
    @Body() dto: ApproveDto,
  ) {
    return await this.jmcService.approve(id, dto, approvedBy);
  }

  @Post(':id/reject')
  @RequiredPermission('financials.jmcs.approve')
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: rejectedBy } }: { user: { id: string } },
    @Body() dto: RejectDto,
  ) {
    return await this.jmcService.reject(id, dto, rejectedBy);
  }

  @Post(':id/unlock-request')
  @RequiredPermission('financials.jmcs.update')
  async requestUnlock(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: requestedBy } }: { user: { id: string } },
    @Body() dto: UnlockRequestDto,
  ) {
    return await this.jmcService.requestUnlock(id, dto, requestedBy);
  }

  @Post(':id/unlock-grant')
  @RequiredPermission('financials.jmcs.unlock')
  async grantUnlock(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: grantedBy } }: { user: { id: string } },
  ) {
    return await this.jmcService.grantUnlock(id, grantedBy);
  }

  @Post(':id/unlock-reject')
  @RequiredPermission('financials.jmcs.unlock')
  @ApiOperation({ summary: 'Reject unlock request — admin (JMC stays locked)' })
  async rejectUnlock(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: rejectedBy } }: { user: { id: string } },
  ) {
    return await this.jmcService.rejectUnlock(id, rejectedBy);
  }
}
