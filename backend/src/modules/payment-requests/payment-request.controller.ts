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
import { PaymentRequestService } from './payment-request.service';
import { DocumentNotifierService } from 'src/modules/notifications/document-notifier.service';
import {
  CreatePaymentRequestDto,
  UpdatePaymentRequestDto,
  ApprovePaymentRequestDto,
  RejectPaymentRequestDto,
  GetPaymentRequestDto,
} from './dto';

@ApiTags('Payment Requests')
@ApiBearerAuth('JWT-auth')
@Controller('payment-requests')
export class PaymentRequestController {
  constructor(
    private readonly service: PaymentRequestService,
    private readonly docs: DocumentNotifierService,
  ) {}

  @Post()
  @RequiredPermission('financials.payment-requests.create')
  @ApiOperation({ summary: 'Raise a payment request against an invoice (project-wise)' })
  async create(
    @Request() { user: { id: createdBy } }: { user: { id: string } },
    @Body() dto: CreatePaymentRequestDto,
  ) {
    const result = await this.service.create(dto, createdBy);
    this.docs.notify('PAYMENT_REQUEST', 'ADDED', result?.id, createdBy);
    return result;
  }

  @Get()
  @RequiredPermission('financials.payment-requests.view-list')
  @ApiOperation({ summary: 'List payment requests' })
  async findAll(@Query() query: GetPaymentRequestDto) {
    return await this.service.findAll(query);
  }

  @Get(':id')
  @RequiredPermission('financials.payment-requests.view-list')
  @ApiOperation({ summary: 'Get a payment request by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.service.findById(id);
  }

  @Patch(':id')
  @RequiredPermission('financials.payment-requests.update')
  @ApiOperation({ summary: 'Edit a payment request (allowed only while PENDING)' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: updatedBy } }: { user: { id: string } },
    @Body() dto: UpdatePaymentRequestDto,
  ) {
    const result = await this.service.update(id, dto, updatedBy);
    this.docs.notify('PAYMENT_REQUEST', 'EDITED', id, updatedBy);
    return result;
  }

  @Delete(':id')
  @RequiredPermission('financials.payment-requests.delete')
  @ApiOperation({ summary: 'Delete a payment request (allowed only while PENDING)' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: deletedBy } }: { user: { id: string } },
  ) {
    const before = await this.docs.snapshot('PAYMENT_REQUEST', id);
    const result = await this.service.remove(id, deletedBy);
    this.docs.notify('PAYMENT_REQUEST', 'DELETED', before, deletedBy);
    return result;
  }

  @Post(':id/approve')
  @RequiredPermission('financials.payment-requests.approve')
  @ApiOperation({
    summary: 'Approve a payment request (optionally adjust amount) — creates a book payment',
  })
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: approvedBy } }: { user: { id: string } },
    @Body() dto: ApprovePaymentRequestDto,
  ) {
    const result = await this.service.approve(id, dto, approvedBy);
    this.docs.notify('PAYMENT_REQUEST', 'APPROVED', id, approvedBy);
    return result;
  }

  @Post(':id/reject')
  @RequiredPermission('financials.payment-requests.approve')
  @ApiOperation({ summary: 'Reject a payment request' })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: rejectedBy } }: { user: { id: string } },
    @Body() dto: RejectPaymentRequestDto,
  ) {
    const result = await this.service.reject(id, dto, rejectedBy);
    this.docs.notify('PAYMENT_REQUEST', 'REJECTED', id, rejectedBy, dto.reason);
    return result;
  }
}
