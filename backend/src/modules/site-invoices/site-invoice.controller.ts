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
import { SiteInvoiceService } from './site-invoice.service';
import { CreateSiteInvoiceDto, UpdateSiteInvoiceDto, GetSiteInvoiceDto } from './dto';
import {
  ApproveDto,
  RejectDto,
  UnlockRequestDto,
} from 'src/modules/purchase-orders/dto/approval.dto';

@ApiTags('Site Invoices')
@ApiBearerAuth('JWT-auth')
@Controller('site-invoices')
export class SiteInvoiceController {
  constructor(private readonly invoiceService: SiteInvoiceService) {}

  @Post()
  @RequiredPermission('financials.invoices.create')
  @ApiOperation({ summary: 'Create an Invoice (PENDING)' })
  async create(
    @Request() { user: { id: createdBy } }: { user: { id: string } },
    @Body() dto: CreateSiteInvoiceDto,
  ) {
    return await this.invoiceService.create(dto, createdBy);
  }

  @Get('dropdown')
  @RequiredPermission('financials.invoices.view')
  @ApiOperation({
    summary: 'Invoice dropdown for Book Payment or Bank Transfer (SALE) creation',
    description:
      'forDocument=book-payment  → returns PURCHASE invoices eligible for a new Book Payment.\n' +
      'forDocument=bank-transfer → returns SALE invoices eligible for a new Bank Transfer.\n' +
      'Ineligible items are included with eligible=false and a human-readable reason.',
  })
  async getDropdown(
    @Query('siteId') siteId: string,
    @Query('forDocument') forDocument: 'book-payment' | 'bank-transfer',
  ) {
    return await this.invoiceService.getDropdown(siteId, forDocument);
  }

  @Get()
  @RequiredPermission('financials.invoices.view')
  async findAll(@Query() query: GetSiteInvoiceDto) {
    return await this.invoiceService.findAll(query);
  }

  @Get(':id')
  @RequiredPermission('financials.invoices.view')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.invoiceService.findById(id);
  }

  @Patch(':id')
  @RequiredPermission('financials.invoices.update')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: updatedBy } }: { user: { id: string } },
    @Body() dto: UpdateSiteInvoiceDto,
  ) {
    return await this.invoiceService.update(id, dto, updatedBy);
  }

  @Delete(':id')
  @RequiredPermission('financials.invoices.delete')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: deletedBy } }: { user: { id: string } },
  ) {
    return await this.invoiceService.remove(id, deletedBy);
  }

  @Post(':id/approve')
  @RequiredPermission('financials.invoices.approve')
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: approvedBy } }: { user: { id: string } },
    @Body() dto: ApproveDto,
  ) {
    return await this.invoiceService.approve(id, dto, approvedBy);
  }

  @Post(':id/reject')
  @RequiredPermission('financials.invoices.approve')
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: rejectedBy } }: { user: { id: string } },
    @Body() dto: RejectDto,
  ) {
    return await this.invoiceService.reject(id, dto, rejectedBy);
  }

  @Post(':id/unlock-request')
  @RequiredPermission('financials.invoices.update')
  async requestUnlock(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: requestedBy } }: { user: { id: string } },
    @Body() dto: UnlockRequestDto,
  ) {
    return await this.invoiceService.requestUnlock(id, dto, requestedBy);
  }

  @Post(':id/unlock-grant')
  @RequiredPermission('financials.invoices.unlock')
  async grantUnlock(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: grantedBy } }: { user: { id: string } },
  ) {
    return await this.invoiceService.grantUnlock(id, grantedBy);
  }

  @Post(':id/unlock-reject')
  @RequiredPermission('financials.invoices.unlock')
  @ApiOperation({ summary: 'Reject unlock request — admin (invoice stays locked)' })
  async rejectUnlock(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: rejectedBy } }: { user: { id: string } },
  ) {
    return await this.invoiceService.rejectUnlock(id, rejectedBy);
  }
}
