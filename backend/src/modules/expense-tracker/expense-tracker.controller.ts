import {
  Controller,
  Post,
  Body,
  Request,
  UseInterceptors,
  Patch,
  Param,
  Get,
  Query,
  Delete,
} from '@nestjs/common';
import { ExpenseTrackerService } from './expense-tracker.service';
import {
  ApiTags,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  FIELD_NAMES,
  FILE_UPLOAD_FOLDER_NAMES,
} from '../common/file-upload/constants/files.constants';
import { ValidateAndUploadFiles } from '../common/file-upload/decorator/file.decorator';
import { EntrySourceType } from 'src/utils/master-constants/master-constants';
import { DetectSource } from './decorators';
import {
  CreateCreditExpenseDto,
  CreateDebitExpenseDto,
  CreditBonusExpenseDto,
  ForceExpenseDto,
  EditExpenseDto,
  ExpenseQueryDto,
  ExpenseListResponseDto,
  ExpenseHistoryResponseDto,
  ExpenseBulkApprovalDto,
  BulkDeleteExpenseDto,
} from './dto';
import { ExpenseUserInterceptor } from './interceptors/expense-user.interceptor';
import { RequestWithTimezone } from './expense-tracker.types';

@ApiTags('Expense Tracker')
@ApiBearerAuth('JWT-auth')
@Controller('expenses')
export class ExpenseTrackerController {
  constructor(private readonly expenseTrackerService: ExpenseTrackerService) {}

  @Post('debit')
  @ApiOperation({
    summary: 'Create debit expense entry',
    description:
      'Creates a new debit expense entry with the provided details and optional file attachments.',
  })
  @UseInterceptors(FileFieldsInterceptor([{ name: FIELD_NAMES.FILES, maxCount: 10 }]))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    type: CreateDebitExpenseDto,
    required: true,
  })
  async createDebitExpense(
    @Request() req: RequestWithTimezone,
    @Body() createExpenseDto: CreateDebitExpenseDto,
    @DetectSource() sourceType: EntrySourceType,
    @ValidateAndUploadFiles(FILE_UPLOAD_FOLDER_NAMES.EXPENSE_FILES)
    { fileKeys }: { fileKeys: string[] } = { fileKeys: [] },
  ) {
    return this.expenseTrackerService.createDebitExpense({
      ...createExpenseDto,
      fileKeys,
      userId: req.user.id,
      userRole: req.user.role,
      sourceType,
      timezone: req.timezone,
    });
  }

  @Post('force')
  @ApiOperation({
    summary: 'Force create expense entry',
    description:
      'Creates an expense entry with forced approval, bypassing normal approval workflow.',
  })
  @UseInterceptors(FileFieldsInterceptor([{ name: FIELD_NAMES.FILES, maxCount: 10 }]))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    type: ForceExpenseDto,
    required: true,
  })
  async forceExpense(
    @Request() req: RequestWithTimezone,
    @Body() forceExpenseDto: ForceExpenseDto,
    @DetectSource() sourceType: EntrySourceType,
    @ValidateAndUploadFiles(FILE_UPLOAD_FOLDER_NAMES.EXPENSE_FILES)
    { fileKeys }: { fileKeys: string[] } = { fileKeys: [] },
  ) {
    return this.expenseTrackerService.forceExpense({
      ...forceExpenseDto,
      createdBy: req.user.id,
      sourceType,
      fileKeys,
      timezone: req.timezone,
    });
  }

  @Post('credit-bonus')
  @ApiOperation({
    summary: 'Create credit bonus expense entry',
    description:
      'Creates a debit expense entry for performance bonus credited to employee. Creates with PENDING status.',
  })
  @UseInterceptors(FileFieldsInterceptor([{ name: FIELD_NAMES.FILES, maxCount: 10 }]))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    type: CreditBonusExpenseDto,
    required: true,
  })
  async creditBonusExpense(
    @Request() req: RequestWithTimezone,
    @Body() creditBonusDto: CreditBonusExpenseDto,
    @DetectSource() sourceType: EntrySourceType,
    @ValidateAndUploadFiles(FILE_UPLOAD_FOLDER_NAMES.EXPENSE_FILES)
    { fileKeys }: { fileKeys: string[] } = { fileKeys: [] },
  ) {
    return this.expenseTrackerService.creditBonusExpense({
      ...creditBonusDto,
      createdBy: req.user.id,
      sourceType,
      fileKeys,
      timezone: req.timezone,
    });
  }

  @Post('credit')
  @ApiOperation({
    summary: 'Create credit expense entry',
    description:
      'Creates a new credit expense entry with the provided details and optional file attachments.',
  })
  @UseInterceptors(FileFieldsInterceptor([{ name: FIELD_NAMES.FILES, maxCount: 10 }]))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    type: CreateCreditExpenseDto,
    required: true,
  })
  async createCreditExpense(
    @Request() req: RequestWithTimezone,
    @Body() createExpenseDto: CreateCreditExpenseDto,
    @DetectSource() sourceType: EntrySourceType,
    @ValidateAndUploadFiles(FILE_UPLOAD_FOLDER_NAMES.EXPENSE_FILES)
    { fileKeys }: { fileKeys: string[] } = { fileKeys: [] },
  ) {
    return this.expenseTrackerService.createCreditExpense({
      ...createExpenseDto,
      createdBy: req.user.id,
      sourceType,
      fileKeys,
      timezone: req.timezone,
    });
  }

  @Patch('/:id')
  @ApiOperation({
    summary: 'Edit expense entry',
    description:
      'Updates an existing expense entry with the provided details and optional file attachments.',
  })
  @UseInterceptors(FileFieldsInterceptor([{ name: FIELD_NAMES.FILES, maxCount: 10 }]))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    type: EditExpenseDto,
    required: true,
  })
  async editExpense(
    @Request() req: RequestWithTimezone,
    @Param('id') id: string,
    @Body() editExpenseDto: EditExpenseDto,
    @DetectSource() sourceType: EntrySourceType,
    @ValidateAndUploadFiles(FILE_UPLOAD_FOLDER_NAMES.EXPENSE_FILES)
    { fileKeys }: { fileKeys: string[] } = { fileKeys: [] },
  ) {
    return this.expenseTrackerService.editExpense({
      ...editExpenseDto,
      id,
      updatedBy: req.user.id,
      userRole: req.user.role,
      entrySourceType: sourceType,
      fileKeys,
      timezone: req.timezone,
    });
  }

  @Post('approval')
  @ApiOperation({
    summary: 'Bulk approve expense entries',
    description: 'Approves multiple expense entries in bulk based on the provided expense IDs.',
  })
  async expenseApproval(
    @Request() { user: { id: approvalBy } }: { user: { id: string } },
    @Body() expenseApprovalDto: ExpenseBulkApprovalDto,
    @DetectSource() sourceType: EntrySourceType,
  ) {
    return this.expenseTrackerService.handleBulkExpenseApproval({
      ...expenseApprovalDto,
      approvalBy,
      entrySourceType: sourceType,
    });
  }

  @Get()
  @ApiOperation({
    summary: 'Get expense records',
    description:
      'Retrieves a list of expense records based on the provided query parameters and filters.',
  })
  @UseInterceptors(ExpenseUserInterceptor)
  @ApiResponse({ status: 200, type: ExpenseListResponseDto })
  async getExpenseRecords(
    @Request() req: RequestWithTimezone,
    @Query() expenseQueryDto: ExpenseQueryDto,
  ) {
    return this.expenseTrackerService.getExpenseRecords(expenseQueryDto, req.user.id);
  }

  @Get(':id/history')
  @ApiOperation({
    summary: 'Get expense history',
    description: 'Retrieves the complete history and audit trail for a specific expense entry.',
  })
  @ApiResponse({ status: 200, type: ExpenseHistoryResponseDto })
  async getExpenseHistory(@Param('id') id: string) {
    return this.expenseTrackerService.getExpenseHistory(id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete expense entry',
    description: 'Deletes a specific expense entry by its ID.',
  })
  async deleteExpense(
    @Request() { user: { id: deletedBy } }: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.expenseTrackerService.deleteExpense(id, deletedBy);
  }

  @Delete()
  @ApiOperation({
    summary: 'Bulk delete expense entries',
    description: 'Deletes multiple expense entries in bulk based on the provided expense IDs.',
  })
  @ApiBody({ type: BulkDeleteExpenseDto })
  async bulkDeleteExpenses(
    @Request() { user: { id: deletedBy, role: userRole } }: { user: { id: string; role: string } },
    @Body() bulkDeleteDto: BulkDeleteExpenseDto,
  ) {
    return this.expenseTrackerService.bulkDeleteExpenses({
      ...bulkDeleteDto,
      deletedBy,
      userRole,
    });
  }
}
