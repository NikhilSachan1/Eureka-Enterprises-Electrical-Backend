import { Controller, Post, Body, Request, UseInterceptors, Patch, Param } from '@nestjs/common';
import { ExpenseTrackerService } from './expense-tracker.service';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
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
  ForceExpenseDto,
  EditExpenseDto,
} from './dto';

@ApiTags('Expense Tracker')
@ApiBearerAuth('JWT-auth')
@Controller('expenses')
export class ExpenseTrackerController {
  constructor(private readonly expenseTrackerService: ExpenseTrackerService) {}

  @Post('debit')
  @UseInterceptors(FileFieldsInterceptor([{ name: FIELD_NAMES.FILES, maxCount: 10 }]))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    type: CreateDebitExpenseDto,
    required: true,
  })
  async createDebitExpense(
    @Request() { user: { id: userId } }: { user: { id: string } },
    @Body() createExpenseDto: CreateDebitExpenseDto,
    @ValidateAndUploadFiles(FILE_UPLOAD_FOLDER_NAMES.EXPENSE_FILES)
    @DetectSource()
    sourceType: EntrySourceType,
  ) {
    return this.expenseTrackerService.createDebitExpense({
      ...createExpenseDto,
      userId,
      sourceType,
    });
  }

  @Post('force')
  @UseInterceptors(FileFieldsInterceptor([{ name: FIELD_NAMES.FILES, maxCount: 10 }]))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    type: ForceExpenseDto,
    required: true,
  })
  async forceExpense(
    @Request() { user: { id: createdBy } }: { user: { id: string } },
    @Body() forceExpenseDto: ForceExpenseDto,
    @ValidateAndUploadFiles(FILE_UPLOAD_FOLDER_NAMES.EXPENSE_FILES)
    @DetectSource()
    sourceType: EntrySourceType,
  ) {
    return this.expenseTrackerService.forceExpense({
      ...forceExpenseDto,
      createdBy,
      sourceType,
    });
  }

  @Post('credit')
  @UseInterceptors(FileFieldsInterceptor([{ name: FIELD_NAMES.FILES, maxCount: 10 }]))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    type: CreateCreditExpenseDto,
    required: true,
  })
  async createCreditExpense(
    @Request() { user: { id: createdBy } }: { user: { id: string } },
    @Body() createExpenseDto: CreateCreditExpenseDto,
    @ValidateAndUploadFiles(FILE_UPLOAD_FOLDER_NAMES.EXPENSE_FILES)
    @DetectSource()
    sourceType: EntrySourceType,
  ) {
    return this.expenseTrackerService.createCreditExpense({
      ...createExpenseDto,
      createdBy,
      sourceType,
    });
  }

  @Patch('/:id')
  @UseInterceptors(FileFieldsInterceptor([{ name: FIELD_NAMES.FILES, maxCount: 10 }]))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    type: EditExpenseDto,
    required: true,
  })
  async editExpense(
    @Request() { user: { id: updatedBy } }: { user: { id: string } },
    @Param('id') id: string,
    @Body() editExpenseDto: EditExpenseDto,
    @ValidateAndUploadFiles(FILE_UPLOAD_FOLDER_NAMES.EXPENSE_FILES)
    @DetectSource()
    sourceType: EntrySourceType,
  ) {
    return this.expenseTrackerService.editExpense({ ...editExpenseDto, id, updatedBy, sourceType });
  }
}
