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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PaymentSheetService, ActingUser } from './payment-sheet.service';
import {
  CreatePaymentSheetDto,
  AddPaymentSheetItemsDto,
  UpdatePaymentSheetDto,
  EditItemAmountDto,
  StageActionDto,
  PayItemDto,
  QueryPaymentSheetDto,
} from './dto';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { RequiredPermission } from 'src/modules/auth/decorators/required-permission.decorator';
import {
  PAYMENT_SHEET_PERMISSIONS,
  PaymentSourceType,
  BeneficiaryType,
} from './constants/payment-sheet.constants';

@ApiTags('Payment Sheets')
@ApiBearerAuth('JWT-auth')
@Controller('payment-sheets')
export class PaymentSheetController {
  constructor(private readonly service: PaymentSheetService) {}

  @Post()
  @RequiredPermission(PAYMENT_SHEET_PERMISSIONS.CREATE)
  @ApiOperation({ summary: 'Create a payment sheet (DRAFT) with initial beneficiary items' })
  create(@Body() dto: CreatePaymentSheetDto, @GetUser() user: ActingUser) {
    return this.service.create(dto, user);
  }

  @Get()
  @RequiredPermission(PAYMENT_SHEET_PERMISSIONS.VIEW)
  @ApiOperation({ summary: 'List payment sheets with filters' })
  findAll(@Query() query: QueryPaymentSheetDto) {
    return this.service.findAll(query);
  }

  @Get(':id/reconcile')
  @RequiredPermission(PAYMENT_SHEET_PERMISSIONS.VIEW)
  @ApiOperation({ summary: 'Live pending vs sheet amount per item, with conflict flags' })
  reconcile(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.reconcile(id);
  }

  @Get(':id/pdf')
  @RequiredPermission(PAYMENT_SHEET_PERMISSIONS.DOWNLOAD)
  @ApiOperation({
    summary: 'Get a download URL for the payment sheet PDF',
    description:
      'Omit filters for the full sheet. Pass sourceType (EXPENSE|FUEL_EXPENSE|VENDOR_PAYMENT) ' +
      'and/or beneficiaryType (USER|VENDOR) to export only those lines with their own subtotal.',
  })
  @ApiQuery({ name: 'sourceType', required: false, enum: PaymentSourceType })
  @ApiQuery({ name: 'beneficiaryType', required: false, enum: BeneficiaryType })
  pdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('sourceType') sourceType?: string,
    @Query('beneficiaryType') beneficiaryType?: string,
  ) {
    return this.service.getPdfUrl(id, { sourceType, beneficiaryType });
  }

  @Get(':id')
  @RequiredPermission(PAYMENT_SHEET_PERMISSIONS.VIEW)
  @ApiOperation({ summary: 'Get a payment sheet with items, history and stage logs' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @RequiredPermission(PAYMENT_SHEET_PERMISSIONS.CREATE)
  @ApiOperation({ summary: 'Edit DRAFT/RETURNED sheet title/remarks' })
  updateMeta(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePaymentSheetDto,
    @GetUser() user: ActingUser,
  ) {
    return this.service.updateMeta(id, dto, user);
  }

  // ── items ──
  @Post(':id/items')
  @RequiredPermission(PAYMENT_SHEET_PERMISSIONS.VIEW)
  @ApiOperation({ summary: 'Add beneficiaries (initiator in DRAFT, or admin at ADMIN_REVIEW)' })
  addItems(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddPaymentSheetItemsDto,
    @GetUser() user: ActingUser,
  ) {
    return this.service.addItems(id, dto, user);
  }

  @Patch(':id/items/:itemId')
  @RequiredPermission(PAYMENT_SHEET_PERMISSIONS.VIEW)
  @ApiOperation({ summary: 'Edit an item amount (HR free / Admin decrease-only)' })
  editItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: EditItemAmountDto,
    @GetUser() user: ActingUser,
  ) {
    return this.service.editItemAmount(id, itemId, dto, user);
  }

  @Delete(':id/items/:itemId')
  @RequiredPermission(PAYMENT_SHEET_PERMISSIONS.VIEW)
  @ApiOperation({ summary: 'Remove a beneficiary (initiator in DRAFT, or admin with reason)' })
  removeItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: StageActionDto,
    @GetUser() user: ActingUser,
  ) {
    return this.service.removeItem(id, itemId, dto, user);
  }

  // ── workflow ──
  @Post(':id/submit')
  @RequiredPermission(PAYMENT_SHEET_PERMISSIONS.CREATE)
  @ApiOperation({ summary: 'Submit the sheet into the approval chain' })
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StageActionDto,
    @GetUser() user: ActingUser,
  ) {
    return this.service.submit(id, dto, user);
  }

  @Post(':id/forward')
  @RequiredPermission(PAYMENT_SHEET_PERMISSIONS.VIEW)
  @ApiOperation({ summary: 'Forward the sheet to the next configured stage' })
  forward(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StageActionDto,
    @GetUser() user: ActingUser,
  ) {
    return this.service.forward(id, dto, user);
  }

  @Post(':id/return')
  @RequiredPermission(PAYMENT_SHEET_PERMISSIONS.VIEW)
  @ApiOperation({ summary: 'Return the sheet to the initiator for rework' })
  returnSheet(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StageActionDto,
    @GetUser() user: ActingUser,
  ) {
    return this.service.returnSheet(id, dto, user);
  }

  @Post(':id/reject')
  @RequiredPermission(PAYMENT_SHEET_PERMISSIONS.VIEW)
  @ApiOperation({ summary: 'Reject the sheet (terminal)' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StageActionDto,
    @GetUser() user: ActingUser,
  ) {
    return this.service.reject(id, dto, user);
  }

  // ── accountant processing ──
  @Post(':id/items/:itemId/pay')
  @RequiredPermission(PAYMENT_SHEET_PERMISSIONS.PROCESS)
  @ApiOperation({ summary: 'Pay an item — performs the settlement write-back' })
  pay(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: PayItemDto,
    @GetUser() user: ActingUser,
  ) {
    return this.service.payItem(id, itemId, dto, user);
  }

  @Post(':id/items/:itemId/hold')
  @RequiredPermission(PAYMENT_SHEET_PERMISSIONS.PROCESS)
  @ApiOperation({ summary: 'Place an item on hold' })
  hold(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: StageActionDto,
    @GetUser() user: ActingUser,
  ) {
    return this.service.holdItem(id, itemId, dto, user);
  }

  @Post(':id/items/:itemId/release')
  @RequiredPermission(PAYMENT_SHEET_PERMISSIONS.PROCESS)
  @ApiOperation({ summary: 'Release a held item (only the accountant who held it)' })
  release(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @GetUser() user: ActingUser,
  ) {
    return this.service.releaseItem(id, itemId, user);
  }

  @Post(':id/items/:itemId/reject')
  @RequiredPermission(PAYMENT_SHEET_PERMISSIONS.PROCESS)
  @ApiOperation({ summary: 'Reject an item (terminal for that line)' })
  rejectItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: StageActionDto,
    @GetUser() user: ActingUser,
  ) {
    return this.service.rejectItem(id, itemId, dto, user);
  }
}
