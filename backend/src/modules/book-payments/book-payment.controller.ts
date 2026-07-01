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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BookPaymentService } from './book-payment.service';
import {
  CreateBookPaymentDto,
  UpdateBookPaymentDto,
  GetBookPaymentDto,
  GetVendorListQueryDto,
  VendorListResponseDto,
} from './dto';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { RequiredPermission } from 'src/modules/auth/decorators/required-permission.decorator';
import { UnlockRequestDto } from 'src/modules/purchase-orders/dto/approval.dto';

@ApiTags('Book Payments')
@ApiBearerAuth('JWT-auth')
@Controller('book-payments')
export class BookPaymentController {
  constructor(private readonly bookPaymentService: BookPaymentService) {}

  @Patch(':id/approve')
  @RequiredPermission('financials.book-payments.approve')
  @ApiOperation({ summary: 'Approve a pending book payment' })
  approve(@Param('id', ParseUUIDPipe) id: string, @GetUser('id') userId: string) {
    return this.bookPaymentService.approve(id, userId);
  }

  @Patch(':id/reject')
  @RequiredPermission('financials.book-payments.approve')
  @ApiOperation({ summary: 'Reject a pending book payment' })
  reject(@Param('id', ParseUUIDPipe) id: string, @GetUser('id') userId: string) {
    return this.bookPaymentService.reject(id, userId);
  }

  @Post()
  @RequiredPermission('financials.book-payments.create')
  @ApiOperation({ summary: 'Create a book payment (PURCHASE side only)' })
  create(@Body() dto: CreateBookPaymentDto, @GetUser('id') userId: string) {
    return this.bookPaymentService.create(dto, userId);
  }

  @Get('vendor-list')
  @RequiredPermission('financials.book-payments.view')
  @ApiOperation({
    summary: 'Vendor book payments list',
    description:
      'Returns all vendors with their approved book payments, each enriched with invoice, JMC, PO, site and company details. Paginated on vendor level.',
  })
  getVendorList(@Query() query: GetVendorListQueryDto): Promise<VendorListResponseDto> {
    return this.bookPaymentService.getVendorList(query);
  }

  @Get('dropdown')
  @RequiredPermission('financials.book-payments.view')
  @ApiOperation({
    summary: 'Book Payment dropdown for PURCHASE Bank Transfer creation',
    description:
      'Returns all Book Payments for an Invoice with eligibility flags. ' +
      'A Book Payment is eligible only when it does not yet have a Bank Transfer ' +
      '(1 BookPayment = 1 BankTransfer, BRD §11 confirmed-2). ' +
      'Ineligible items are included with eligible=false and a reason.',
  })
  getDropdown(@Query('invoiceId') invoiceId: string) {
    return this.bookPaymentService.getDropdown(invoiceId);
  }

  @Get()
  @RequiredPermission('financials.book-payments.view')
  @ApiOperation({ summary: 'List book payments with filters and pagination' })
  findAll(@Query() query: GetBookPaymentDto) {
    return this.bookPaymentService.findAll(query);
  }

  @Get(':id')
  @RequiredPermission('financials.book-payments.view')
  @ApiOperation({ summary: 'Get a single book payment by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.bookPaymentService.findById(id);
  }

  @Patch(':id')
  @RequiredPermission('financials.book-payments.update')
  @ApiOperation({ summary: 'Update a book payment (only if no bank transfer exists)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBookPaymentDto,
    @GetUser('id') userId: string,
  ) {
    return this.bookPaymentService.update(id, dto, userId);
  }

  @Delete(':id')
  @RequiredPermission('financials.book-payments.delete')
  @ApiOperation({ summary: 'Delete a book payment (only if no bank transfer exists)' })
  remove(@Param('id', ParseUUIDPipe) id: string, @GetUser('id') userId: string) {
    return this.bookPaymentService.remove(id, userId);
  }

  @Post(':id/unlock-request')
  @RequiredPermission('financials.book-payments.update')
  @ApiOperation({ summary: 'Request unlock for an approved+locked book payment' })
  requestUnlock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UnlockRequestDto,
    @GetUser('id') userId: string,
  ) {
    return this.bookPaymentService.requestUnlock(id, dto, userId);
  }

  @Post(':id/unlock-grant')
  @RequiredPermission('financials.book-payments.unlock')
  @ApiOperation({ summary: 'Grant unlock request — admin (book payment becomes editable)' })
  grantUnlock(@Param('id', ParseUUIDPipe) id: string, @GetUser('id') userId: string) {
    return this.bookPaymentService.grantUnlock(id, userId);
  }

  @Post(':id/unlock-reject')
  @RequiredPermission('financials.book-payments.unlock')
  @ApiOperation({ summary: 'Reject unlock request — admin (book payment stays locked)' })
  rejectUnlock(@Param('id', ParseUUIDPipe) id: string, @GetUser('id') userId: string) {
    return this.bookPaymentService.rejectUnlock(id, userId);
  }
}
