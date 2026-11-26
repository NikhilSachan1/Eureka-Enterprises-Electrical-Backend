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
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  FIELD_NAMES,
  FILE_UPLOAD_FOLDER_NAMES,
} from 'src/modules/common/file-upload/constants/files.constants';
import { ValidateAndUploadFiles } from 'src/modules/common/file-upload/decorator/file.decorator';
import { EntrySourceType } from 'src/utils/master-constants/master-constants';
import { DetectSource } from 'src/modules/expense-tracker/decorators';
import { RequestWithTimezone } from 'src/modules/expense-tracker/expense-tracker.types';
import { CreateCreditExpenseDto } from 'src/modules/expense-tracker/dto';
import { CreateCreditFuelExpenseDto } from 'src/modules/fuel-expense/dto';
import { CreateBankTransferDto } from 'src/modules/bank-transfers/dto';
import { PaymentSheetService, ActingUser } from './payment-sheet.service';
import {
  CreatePaymentSheetDto,
  AddPaymentSheetItemsDto,
  UpdatePaymentSheetDto,
  EditItemAmountDto,
  StageActionDto,
  PayItemDto,
  QueryPaymentSheetDto,
  VerifyItemsDto,
  UnverifyItemsDto,
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

  // ── direct pay: settle from the source screen + auto-create a COMPLETED sheet ──
  // Same bodies / permissions as expenses/credit, fuel-expenses/credit and bank-transfers, which stay as-is.
  @Post('direct/expense-reimburse')
  @ApiOperation({
    summary: 'Reimburse an expense and record it on an auto-created payment sheet',
    description:
      'Same input as POST expenses/credit. Settles the expense, then creates a COMPLETED ' +
      'payment sheet with one PAID line for it.',
  })
  @UseInterceptors(FileFieldsInterceptor([{ name: FIELD_NAMES.FILES, maxCount: 10 }]))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateCreditExpenseDto, required: true })
  directExpenseReimburse(
    @Request() req: RequestWithTimezone,
    @Body() dto: CreateCreditExpenseDto,
    @DetectSource() sourceType: EntrySourceType,
    @ValidateAndUploadFiles(FILE_UPLOAD_FOLDER_NAMES.EXPENSE_FILES)
    { fileKeys }: { fileKeys: string[] } = { fileKeys: [] },
  ) {
    return this.service.directExpenseReimburse(
      { ...dto, fileKeys, sourceType, timezone: req.timezone },
      this.actingUser(req),
    );
  }

  @Post('direct/fuel-expense-reimburse')
  @ApiOperation({
    summary: 'Reimburse a fuel expense and record it on an auto-created payment sheet',
    description:
      'Same input as POST fuel-expenses/credit. Settles the fuel expense, then creates a ' +
      'COMPLETED payment sheet with one PAID line for it.',
  })
  @UseInterceptors(FileFieldsInterceptor([{ name: FIELD_NAMES.FILES, maxCount: 10 }]))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateCreditFuelExpenseDto, required: true })
  directFuelReimburse(
    @Request() req: RequestWithTimezone,
    @Body() dto: CreateCreditFuelExpenseDto,
    @DetectSource() sourceType: EntrySourceType,
    @ValidateAndUploadFiles(FILE_UPLOAD_FOLDER_NAMES.FUEL_EXPENSE_FILES)
    { fileKeys }: { fileKeys: string[] } = { fileKeys: [] },
  ) {
    return this.service.directFuelReimburse(
      { ...dto, fileKeys, sourceType, timezone: req.timezone },
      this.actingUser(req),
    );
  }

  @Post('direct/bank-transfer')
  @RequiredPermission('financials.bank-transfers.create')
  @ApiOperation({
    summary: 'Create a PURCHASE bank transfer and record it on an auto-created payment sheet',
    description:
      'Same input as POST bank-transfers (PURCHASE only). Creates the transfer and its payment ' +
      'advice, then a COMPLETED payment sheet with one PAID vendor line for it.',
  })
  directBankTransfer(@Body() dto: CreateBankTransferDto, @GetUser() user: ActingUser) {
    return this.service.directBankTransfer(dto, user);
  }

  private actingUser(req: RequestWithTimezone): ActingUser {
    return { id: req.user.id, activeRole: req.user.activeRole ?? req.user.role ?? '' };
  }

  @Get()
  @RequiredPermission(PAYMENT_SHEET_PERMISSIONS.VIEW_LIST)
  @ApiOperation({ summary: 'List payment sheets with filters' })
  findAll(@Query() query: QueryPaymentSheetDto) {
    return this.service.findAll(query);
  }

  @Get(':id/reconcile')
  @RequiredPermission(PAYMENT_SHEET_PERMISSIONS.RECONCILE)
  @ApiOperation({ summary: 'Live pending vs sheet amount per item, with conflict flags' })
  reconcile(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.reconcile(id);
  }

  @Post(':id/sync-amounts')
  @RequiredPermission(PAYMENT_SHEET_PERMISSIONS.SYNC_AMOUNTS)
  @ApiOperation({
    summary: 'Sync line amounts to latest pending (initiator only, DRAFT/RETURNED)',
    description:
      'Re-pulls live pending and saves it onto each line. Vendor lines refresh their ' +
      'book-payment allocations; lines with zero remaining pending are removed. All changes logged.',
  })
  syncAmounts(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: ActingUser) {
    return this.service.syncToLatest(id, user);
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
  @RequiredPermission(PAYMENT_SHEET_PERMISSIONS.VIEW_DETAIL)
  @ApiOperation({ summary: 'Get a payment sheet with items, history and stage logs' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @RequiredPermission(PAYMENT_SHEET_PERMISSIONS.UPDATE)
  @ApiOperation({ summary: 'Edit DRAFT/RETURNED sheet title/remarks' })
  updateMeta(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePaymentSheetDto,
    @GetUser() user: ActingUser,
  ) {
    return this.service.updateMeta(id, dto, user);
  }

  @Delete(':id')
  @RequiredPermission(PAYMENT_SHEET_PERMISSIONS.DELETE)
  @ApiOperation({
    summary: 'Delete a payment sheet (soft)',
    description:
      'Initiator (own) or SUPER_ADMIN. Only while DRAFT/RETURNED (before it moves to HR) ' +
      'and only if no line item is PAID/HOLD. Cascades to items and allocations.',
  })
  deleteSheet(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: ActingUser) {
    return this.service.deleteSheet(id, user);
  }

  // ── items ──
  @Post(':id/items')
  @RequiredPermission(PAYMENT_SHEET_PERMISSIONS.ITEM_ADD)
  @ApiOperation({ summary: 'Add beneficiaries (initiator in DRAFT, or admin at ADMIN_REVIEW)' })
  addItems(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddPaymentSheetItemsDto,
    @GetUser() user: ActingUser,
  ) {
    return this.service.addItems(id, dto, user);
  }

  @Patch(':id/items/:itemId')
  @RequiredPermission(PAYMENT_SHEET_PERMISSIONS.ITEM_EDIT)
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
  @RequiredPermission(PAYMENT_SHEET_PERMISSIONS.ITEM_REMOVE)
  @ApiOperation({ summary: 'Remove a beneficiary (initiator in DRAFT, or admin with reason)' })
  removeItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: StageActionDto,
    @GetUser() user: ActingUser,
  ) {
    return this.service.removeItem(id, itemId, dto, user);
  }

  // ── verification (HR / Admin review stages) ──
  @Post(':id/verify')
  @RequiredPermission(PAYMENT_SHEET_PERMISSIONS.BENEFICIARY_VERIFY)
  @ApiOperation({
    summary: 'Verify lines for the current review stage (bulk)',
    description: 'Pass { itemIds: [...] } to verify specific lines, or omit itemIds to verify all.',
  })
  verify(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyItemsDto,
    @GetUser() user: ActingUser,
  ) {
    return this.service.verifyItems(id, dto, user);
  }

  @Post(':id/unverify')
  @RequiredPermission(PAYMENT_SHEET_PERMISSIONS.BENEFICIARY_UNVERIFY)
  @ApiOperation({ summary: 'Remove this stage’s verification from the listed lines (bulk)' })
  unverify(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UnverifyItemsDto,
    @GetUser() user: ActingUser,
  ) {
    return this.service.unverifyItems(id, dto, user);
  }

  // ── workflow ──
  @Post(':id/submit')
  @RequiredPermission(PAYMENT_SHEET_PERMISSIONS.SUBMIT)
  @ApiOperation({ summary: 'Submit the sheet into the approval chain' })
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StageActionDto,
    @GetUser() user: ActingUser,
  ) {
    return this.service.submit(id, dto, user);
  }

  @Post(':id/forward')
  @RequiredPermission(PAYMENT_SHEET_PERMISSIONS.FORWARD)
  @ApiOperation({ summary: 'Forward the sheet to the next configured stage' })
  forward(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StageActionDto,
    @GetUser() user: ActingUser,
  ) {
    return this.service.forward(id, dto, user);
  }

  @Post(':id/return')
  @RequiredPermission(PAYMENT_SHEET_PERMISSIONS.RETURN)
  @ApiOperation({ summary: 'Return the sheet to the initiator for rework' })
  returnSheet(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StageActionDto,
    @GetUser() user: ActingUser,
  ) {
    return this.service.returnSheet(id, dto, user);
  }

  @Post(':id/reject')
  @RequiredPermission(PAYMENT_SHEET_PERMISSIONS.SHEET_REJECT)
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
  @RequiredPermission(PAYMENT_SHEET_PERMISSIONS.ITEM_PAY)
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
  @RequiredPermission(PAYMENT_SHEET_PERMISSIONS.ITEM_HOLD)
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
  @RequiredPermission(PAYMENT_SHEET_PERMISSIONS.ITEM_RELEASE)
  @ApiOperation({ summary: 'Release a held item (only the accountant who held it)' })
  release(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @GetUser() user: ActingUser,
  ) {
    return this.service.releaseItem(id, itemId, user);
  }

  @Post(':id/items/:itemId/reject')
  @RequiredPermission(PAYMENT_SHEET_PERMISSIONS.ITEM_REJECT)
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
