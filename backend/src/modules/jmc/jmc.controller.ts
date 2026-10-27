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
import { DocumentNotifierService } from 'src/modules/notifications/document-notifier.service';
import { CreateJmcDto, UpdateJmcDto, GetJmcDto, UploadJmcDto, JmcItemSuggestionDto } from './dto';
import {
  ApproveDto,
  RejectDto,
  UnlockRequestDto,
} from 'src/modules/purchase-orders/dto/approval.dto';

@ApiTags('JMCs')
@ApiBearerAuth('JWT-auth')
@Controller('jmcs')
export class JmcController {
  constructor(
    private readonly jmcService: JmcService,
    private readonly docs: DocumentNotifierService,
  ) {}

  @Post()
  @RequiredPermission('financials.jmcs.create')
  @ApiOperation({
    summary: 'Create a JMC against an APPROVED PO',
    description:
      'Send `noJmc: true` with `poId` to raise a No-JMC entry instead — allowed only on an ' +
      'APPROVED, PURCHASE, Supply Item PO. It has no number, no date and no signed copy, and ' +
      'exists only so an invoice on such a PO has a parent to hang off.',
  })
  async create(
    @Request()
    { user: { id: createdBy, activeRole } }: { user: { id: string; activeRole?: string } },
    @Body() dto: CreateJmcDto,
  ) {
    const result = await this.jmcService.create(dto, createdBy, activeRole);
    this.docs.notify('JMC', 'ADDED', result?.id, createdBy);
    return result;
  }

  @Get('dropdown')
  @RequiredPermission('financials.jmcs.view-list')
  @ApiOperation({
    summary: 'JMC dropdown for Report or Invoice creation',
    description:
      'Returns JMCs for a site+partyType with per-item eligibility flags. ' +
      'Use forDocument=report when building the JMC dropdown for Report creation; ' +
      'use forDocument=invoice when building the JMC dropdown for Invoice creation. ' +
      'Ineligible items include the reason so the UI can show a tooltip. ' +
      'No-JMC entries appear only for forDocument=invoice, labelled "No JMC — <party> — <date>" ' +
      'and flagged with meta.isNoJmc.',
  })
  async getDropdown(
    @Query('siteId') siteId: string,
    @Query('partyType') partyType: string,
    @Query('forDocument') forDocument: 'report' | 'invoice',
    // Optional. Narrows the list to one PO, and — for an invoice on a Supply Item PO — adds the
    // "No JMC" option. Validated here so a malformed id is a 400 rather than a 500 from Postgres.
    @Query('poId', new ParseUUIDPipe({ optional: true })) poId?: string,
  ) {
    return await this.jmcService.getDropdown(siteId, partyType, forDocument, poId);
  }

  @Get('items/suggestions')
  @ApiOperation({
    summary: 'Global JMC item-name suggestions (typeahead)',
    description: 'Returns distinct item names from the global master, matching the search text.',
  })
  async itemSuggestions(@Query() query: JmcItemSuggestionDto) {
    return await this.jmcService.getItemSuggestions(query);
  }

  @Get()
  @RequiredPermission('financials.jmcs.view-list')
  @ApiOperation({ summary: 'List JMCs' })
  async findAll(@Query() query: GetJmcDto) {
    return await this.jmcService.findAll(query);
  }

  @Get(':id')
  @RequiredPermission('financials.jmcs.view-list')
  @ApiOperation({ summary: 'Get a JMC by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.jmcService.findById(id);
  }

  @Get(':id/pdf')
  @ApiOperation({
    summary: 'Download URL for the system-generated JMC PDF',
    description:
      'Always regenerated fresh (never cached). SALE + system-generated (has items) only. ' +
      'No specific JMC permission required — any authenticated user can call this.',
  })
  async pdf(@Param('id', ParseUUIDPipe) id: string) {
    return await this.jmcService.generatePdf(id);
  }

  @Patch(':id')
  @RequiredPermission('financials.jmcs.update')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: updatedBy } }: { user: { id: string } },
    @Body() dto: UpdateJmcDto,
  ) {
    const result = await this.jmcService.update(id, dto, updatedBy);
    this.docs.notify('JMC', 'EDITED', id, updatedBy);
    return result;
  }

  @Patch(':id/upload')
  @ApiOperation({
    summary: 'Attach the signed JMC copy to an existing record',
    description:
      'Uploads the signed file against the existing JMC — no PO/date/number re-entry. ' +
      'No specific JMC permission required — any authenticated user can call this.',
  })
  async uploadSignedCopy(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: updatedBy } }: { user: { id: string } },
    @Body() dto: UploadJmcDto,
  ) {
    return await this.jmcService.uploadSignedCopy(id, dto, updatedBy);
  }

  @Delete(':id')
  @RequiredPermission('financials.jmcs.delete')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: deletedBy } }: { user: { id: string } },
  ) {
    const before = await this.docs.snapshot('JMC', id);
    const result = await this.jmcService.remove(id, deletedBy);
    this.docs.notify('JMC', 'DELETED', before, deletedBy);
    return result;
  }

  @Post(':id/approve')
  @RequiredPermission('financials.jmcs.approve')
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: approvedBy } }: { user: { id: string } },
    @Body() dto: ApproveDto,
  ) {
    const result = await this.jmcService.approve(id, dto, approvedBy);
    this.docs.notify('JMC', 'APPROVED', id, approvedBy);
    return result;
  }

  @Post(':id/reject')
  @RequiredPermission('financials.jmcs.approve')
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: rejectedBy } }: { user: { id: string } },
    @Body() dto: RejectDto,
  ) {
    const result = await this.jmcService.reject(id, dto, rejectedBy);
    this.docs.notify('JMC', 'REJECTED', id, rejectedBy, dto.reason);
    return result;
  }

  @Post(':id/unlock-request')
  @RequiredPermission('financials.jmcs.update')
  async requestUnlock(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: requestedBy } }: { user: { id: string } },
    @Body() dto: UnlockRequestDto,
  ) {
    const result = await this.jmcService.requestUnlock(id, dto, requestedBy);
    this.docs.notify('JMC', 'UNLOCK_REQUESTED', id, requestedBy, dto.reason);
    return result;
  }

  @Post(':id/unlock-grant')
  @RequiredPermission('financials.jmcs.unlock')
  async grantUnlock(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: grantedBy } }: { user: { id: string } },
  ) {
    const before = await this.docs.snapshot('JMC', id);
    const result = await this.jmcService.grantUnlock(id, grantedBy);
    this.docs.notify('JMC', 'UNLOCK_GRANTED', before, grantedBy);
    return result;
  }

  @Post(':id/unlock-reject')
  @RequiredPermission('financials.jmcs.unlock')
  @ApiOperation({ summary: 'Reject unlock request — admin (JMC stays locked)' })
  async rejectUnlock(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: rejectedBy } }: { user: { id: string } },
  ) {
    const before = await this.docs.snapshot('JMC', id);
    const result = await this.jmcService.rejectUnlock(id, rejectedBy);
    this.docs.notify('JMC', 'UNLOCK_REJECTED', before, rejectedBy);
    return result;
  }
}
