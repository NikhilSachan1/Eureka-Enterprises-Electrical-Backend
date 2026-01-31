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
import { FuelExpenseService } from './fuel-expense.service';
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
import {
  CreateFuelExpenseDto,
  ForceFuelExpenseDto,
  CreateCreditFuelExpenseDto,
  EditFuelExpenseDto,
  FuelExpenseQueryDto,
  FuelExpenseBulkApprovalDto,
  FuelExpenseListResponseDto,
  BulkDeleteFuelExpenseDto,
} from './dto';
import { EntrySourceType } from 'src/utils/master-constants/master-constants';
import { DetectSource } from './decorators/source-detector.decorator';
import { FuelExpenseUserInterceptor } from './interceptors/fuel-expense-user.interceptor';
import { RequestWithTimezone } from './fuel-expense.types';

@ApiTags('Fuel Expense')
@ApiBearerAuth('JWT-auth')
@Controller('fuel-expenses')
export class FuelExpenseController {
  constructor(private readonly fuelExpenseService: FuelExpenseService) {}

  @Post()
  @ApiOperation({
    summary: 'Create fuel expense entry',
    description:
      'Creates a new fuel expense entry with the provided details and optional file attachments.',
  })
  @UseInterceptors(FileFieldsInterceptor([{ name: FIELD_NAMES.FILES, maxCount: 10 }]))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    type: CreateFuelExpenseDto,
    required: true,
  })
  async createFuelExpense(
    @Request() req: RequestWithTimezone,
    @Body() createFuelExpenseDto: CreateFuelExpenseDto,
    @DetectSource() sourceType: EntrySourceType,
    @ValidateAndUploadFiles(FILE_UPLOAD_FOLDER_NAMES.FUEL_EXPENSE_FILES)
    { fileKeys }: { fileKeys: string[] } = { fileKeys: [] },
  ) {
    const userId = req.user.id;
    return this.fuelExpenseService.create({
      ...createFuelExpenseDto,
      userId,
      createdBy: userId,
      fileKeys,
      entrySourceType: sourceType,
      timezone: req.timezone,
    });
  }

  @Post('force')
  @ApiOperation({
    summary: 'Force create fuel expense entry',
    description:
      'Creates a fuel expense entry with forced approval, bypassing normal approval workflow.',
  })
  @UseInterceptors(FileFieldsInterceptor([{ name: FIELD_NAMES.FILES, maxCount: 10 }]))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    type: ForceFuelExpenseDto,
    required: true,
  })
  async forceFuelExpense(
    @Request() req: RequestWithTimezone,
    @Body() forceFuelExpenseDto: ForceFuelExpenseDto,
    @DetectSource() sourceType: EntrySourceType,
    @ValidateAndUploadFiles(FILE_UPLOAD_FOLDER_NAMES.FUEL_EXPENSE_FILES)
    { fileKeys }: { fileKeys: string[] } = { fileKeys: [] },
  ) {
    const loggedInUserId = req.user.id;
    return this.fuelExpenseService.forceFuelExpense({
      ...forceFuelExpenseDto,
      userId: forceFuelExpenseDto.userId || loggedInUserId,
      createdBy: loggedInUserId,
      fileKeys,
      entrySourceType: sourceType,
      timezone: req.timezone,
    });
  }

  @Post('credit')
  @ApiOperation({
    summary: 'Create credit fuel expense entry',
    description:
      'Creates a new credit fuel expense entry with the provided details and optional file attachments.',
  })
  @UseInterceptors(FileFieldsInterceptor([{ name: FIELD_NAMES.FILES, maxCount: 10 }]))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    type: CreateCreditFuelExpenseDto,
    required: true,
  })
  async createCreditFuelExpense(
    @Request() req: RequestWithTimezone,
    @Body() createCreditFuelExpenseDto: CreateCreditFuelExpenseDto,
    @DetectSource() sourceType: EntrySourceType,
    @ValidateAndUploadFiles(FILE_UPLOAD_FOLDER_NAMES.FUEL_EXPENSE_FILES)
    { fileKeys }: { fileKeys: string[] } = { fileKeys: [] },
  ) {
    const createdBy = req.user.id;
    return this.fuelExpenseService.createCreditFuelExpense({
      ...createCreditFuelExpenseDto,
      createdBy,
      fileKeys,
      entrySourceType: sourceType,
      timezone: req.timezone,
    });
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Edit fuel expense entry',
    description:
      'Updates an existing fuel expense entry with the provided details and optional file attachments.',
  })
  @UseInterceptors(FileFieldsInterceptor([{ name: FIELD_NAMES.FILES, maxCount: 10 }]))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    type: EditFuelExpenseDto,
    required: true,
  })
  async editFuelExpense(
    @Request() req: RequestWithTimezone,
    @Param('id') id: string,
    @Body() editFuelExpenseDto: EditFuelExpenseDto,
    @DetectSource() sourceType: EntrySourceType,
    @ValidateAndUploadFiles(FILE_UPLOAD_FOLDER_NAMES.FUEL_EXPENSE_FILES)
    { fileKeys }: { fileKeys: string[] } = { fileKeys: [] },
  ) {
    const updatedBy = req.user.id;
    return this.fuelExpenseService.editFuelExpense({
      ...editFuelExpenseDto,
      id,
      updatedBy,
      fileKeys,
      entrySourceType: sourceType,
      timezone: req.timezone,
    });
  }

  @Get()
  @ApiOperation({
    summary: 'Get fuel expense records',
    description:
      'Retrieves a list of fuel expense records based on the provided query parameters and filters.',
  })
  @UseInterceptors(FuelExpenseUserInterceptor)
  @ApiResponse({ status: 200, type: FuelExpenseListResponseDto })
  async getFuelExpenseRecords(@Query() fuelExpenseQueryDto: FuelExpenseQueryDto) {
    return this.fuelExpenseService.getFuelExpenseRecords(fuelExpenseQueryDto);
  }

  @Get(':id/history')
  @ApiOperation({
    summary: 'Get fuel expense history',
    description:
      'Retrieves the complete history and audit trail for a specific fuel expense entry.',
  })
  async getFuelExpenseHistory(@Param('id') id: string) {
    return this.fuelExpenseService.getFuelExpenseHistory(id);
  }

  @Get('vehicle/:vehicleId/average')
  @ApiOperation({
    summary: 'Get vehicle fuel average',
    description: 'Calculates and retrieves the average fuel consumption for a specific vehicle.',
  })
  async getVehicleAverage(@Param('vehicleId') vehicleId: string) {
    const average = await this.fuelExpenseService.calculateVehicleAverage(vehicleId);
    return average;
  }

  @Post('approval')
  @ApiOperation({
    summary: 'Bulk approve fuel expense entries',
    description:
      'Approves multiple fuel expense entries in bulk based on the provided expense IDs.',
  })
  async bulkApproveFuelExpenses(
    @Request() { user: { id: approvalBy } }: { user: { id: string } },
    @Body() bulkApprovalDto: FuelExpenseBulkApprovalDto,
    @DetectSource() sourceType: EntrySourceType,
  ) {
    return this.fuelExpenseService.handleBulkFuelExpenseApproval({
      ...bulkApprovalDto,
      approvalBy,
      entrySourceType: sourceType,
    });
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete fuel expense entry',
    description: 'Deletes a specific fuel expense entry by its ID.',
  })
  async deleteFuelExpense(
    @Request() { user: { id: deletedBy } }: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.fuelExpenseService.delete(id, deletedBy);
  }

  @Delete()
  @ApiOperation({
    summary: 'Bulk delete fuel expense entries',
    description: 'Deletes multiple fuel expense entries in bulk based on the provided expense IDs.',
  })
  @ApiBody({ type: BulkDeleteFuelExpenseDto })
  async bulkDeleteFuelExpenses(
    @Request() { user: { id: deletedBy, role: userRole } }: { user: { id: string; role: string } },
    @Body() bulkDeleteDto: BulkDeleteFuelExpenseDto,
  ) {
    return this.fuelExpenseService.bulkDeleteFuelExpenses({
      ...bulkDeleteDto,
      deletedBy,
      userRole,
    });
  }
}
