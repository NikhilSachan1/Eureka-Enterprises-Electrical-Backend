import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequiredPermission } from 'src/modules/auth/decorators/required-permission.decorator';
import { AdvancePaymentService } from './advance-payment.service';
import { CreateAdvancePaymentDto, UpdateAdvancePaymentDto, GetAdvancePaymentDto } from './dto';
import { RejectDto } from 'src/modules/purchase-orders/dto/approval.dto';

@ApiTags('Advance Payments')
@ApiBearerAuth('JWT-auth')
@Controller('advance-payments')
export class AdvancePaymentController {
  constructor(private readonly advanceService: AdvancePaymentService) {}

  /**
   * Declared before the `:id` routes so the literal path is matched first, following the
   * `GET /vendors/next-code` precedent in this codebase.
   */
  @Get('next-number')
  @RequiredPermission('financials.advance-payments.view-list')
  @ApiOperation({ summary: 'Preview the advance number the next created advance will receive' })
  async nextNumber() {
    return await this.advanceService.previewNextNumber();
  }

  @Post()
  @RequiredPermission('financials.advance-payments.create')
  @ApiOperation({
    summary: 'Record an advance paid to a vendor against a PO',
    description:
      'For money paid before the vendor has raised any JMC/invoice. The PO must be an APPROVED ' +
      'PURCHASE PO, and the caller must be the Project Manager of that site (office roles bypass). ' +
      'The advance number is generated server-side. Amount is a single final figure — no GST/TDS.',
  })
  async create(
    @Request()
    { user: { id: createdBy, activeRole } }: { user: { id: string; activeRole?: string } },
    @Body() dto: CreateAdvancePaymentDto,
  ) {
    return await this.advanceService.create(dto, createdBy, activeRole);
  }

  @Get()
  @RequiredPermission('financials.advance-payments.view-list')
  @ApiOperation({ summary: 'List advance payments' })
  async findAll(@Query() query: GetAdvancePaymentDto) {
    return await this.advanceService.findAll(query);
  }

  @Get(':id')
  @RequiredPermission('financials.advance-payments.view-list')
  @ApiOperation({ summary: 'Get an advance payment by id' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.advanceService.findOne(id);
  }

  @Patch(':id')
  @RequiredPermission('financials.advance-payments.update')
  @ApiOperation({
    summary: 'Edit an advance payment',
    description:
      'Allowed only while the advance has no book payment and nothing settled against it. ' +
      'The PO cannot be changed — delete and recreate instead.',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: updatedBy } }: { user: { id: string } },
    @Body() dto: UpdateAdvancePaymentDto,
  ) {
    return await this.advanceService.update(id, dto, updatedBy);
  }

  @Delete(':id')
  @RequiredPermission('financials.advance-payments.delete')
  @ApiOperation({
    summary: 'Delete an advance payment',
    description: 'Allowed only while it has no book payment and nothing settled against it.',
  })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: deletedBy } }: { user: { id: string } },
  ) {
    return await this.advanceService.remove(id, deletedBy);
  }

  @Post(':id/approve')
  @RequiredPermission('financials.advance-payments.approve')
  @ApiOperation({
    summary: 'Approve an advance payment',
    description:
      'Only an approved advance can be booked or settled against an invoice. The PO ceiling is ' +
      're-checked here, since other advances on the same PO may have been approved meanwhile.',
  })
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: approvedBy } }: { user: { id: string } },
  ) {
    return await this.advanceService.approve(id, approvedBy);
  }

  @Post(':id/reject')
  @RequiredPermission('financials.advance-payments.approve')
  @ApiOperation({ summary: 'Reject an advance payment (reason required)' })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: rejectedBy } }: { user: { id: string } },
    @Body() dto: RejectDto,
  ) {
    return await this.advanceService.reject(id, dto, rejectedBy);
  }
}
