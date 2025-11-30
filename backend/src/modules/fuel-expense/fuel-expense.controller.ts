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
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody, ApiResponse } from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  FIELD_NAMES,
  FILE_UPLOAD_FOLDER_NAMES,
} from '../common/file-upload/constants/files.constants';
import { ValidateAndUploadFiles } from '../common/file-upload/decorator/file.decorator';
import {
  CreateFuelExpenseDto,
  EditFuelExpenseDto,
  FuelExpenseQueryDto,
  FuelExpenseBulkApprovalDto,
  FuelExpenseListResponseDto,
} from './dto';
import { EntrySourceType } from 'src/utils/master-constants/master-constants';
import { DetectSource } from './decorators/source-detector.decorator';
import { FuelExpenseUserInterceptor } from './interceptors/fuel-expense-user.interceptor';

@ApiTags('Fuel Expense')
@ApiBearerAuth('JWT-auth')
@Controller('fuel-expenses')
export class FuelExpenseController {
  constructor(private readonly fuelExpenseService: FuelExpenseService) {}

  @Post()
  @UseInterceptors(FileFieldsInterceptor([{ name: FIELD_NAMES.FILES, maxCount: 10 }]))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    type: CreateFuelExpenseDto,
    required: true,
  })
  async createFuelExpense(
    @Request() { user: { id: userId } }: { user: { id: string }; sourceType: string },
    @Body() createFuelExpenseDto: CreateFuelExpenseDto,
    @DetectSource() sourceType: EntrySourceType,
    @ValidateAndUploadFiles(FILE_UPLOAD_FOLDER_NAMES.FUEL_EXPENSE_FILES)
    { fileKeys }: { fileKeys: string[] } = { fileKeys: [] },
  ) {
    return this.fuelExpenseService.create({
      ...createFuelExpenseDto,
      userId,
      createdBy: userId,
      fileKeys,
      entrySourceType: sourceType,
    });
  }

  @Post('force')
  @UseInterceptors(FileFieldsInterceptor([{ name: FIELD_NAMES.FILES, maxCount: 10 }]))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    type: CreateFuelExpenseDto,
    required: true,
  })
  async forceFuelExpense(
    @Request() { user: { id: userId } }: { user: { id: string } },
    @Body() createFuelExpenseDto: CreateFuelExpenseDto,
    @DetectSource() sourceType: EntrySourceType,
    @ValidateAndUploadFiles(FILE_UPLOAD_FOLDER_NAMES.FUEL_EXPENSE_FILES)
    { fileKeys }: { fileKeys: string[] } = { fileKeys: [] },
  ) {
    return this.fuelExpenseService.forceFuelExpense({
      ...createFuelExpenseDto,
      userId: createFuelExpenseDto.userId || userId,
      createdBy: userId,
      fileKeys,
      entrySourceType: sourceType,
    });
  }

  @Patch(':id')
  @UseInterceptors(FileFieldsInterceptor([{ name: FIELD_NAMES.FILES, maxCount: 10 }]))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    type: EditFuelExpenseDto,
    required: true,
  })
  async editFuelExpense(
    @Request()
    { user: { id: updatedBy } }: { user: { id: string } },
    @Param('id') id: string,
    @Body() editFuelExpenseDto: EditFuelExpenseDto,
    @DetectSource() sourceType: EntrySourceType,
    @ValidateAndUploadFiles(FILE_UPLOAD_FOLDER_NAMES.FUEL_EXPENSE_FILES)
    { fileKeys }: { fileKeys: string[] } = { fileKeys: [] },
  ) {
    return this.fuelExpenseService.editFuelExpense({
      ...editFuelExpenseDto,
      id,
      updatedBy,
      fileKeys,
      entrySourceType: sourceType,
    });
  }

  @Get()
  @UseInterceptors(FuelExpenseUserInterceptor)
  @ApiResponse({ status: 200, type: FuelExpenseListResponseDto })
  async getFuelExpenseRecords(@Query() fuelExpenseQueryDto: FuelExpenseQueryDto) {
    return this.fuelExpenseService.getFuelExpenseRecords(fuelExpenseQueryDto);
  }

  @Get(':id/history')
  async getFuelExpenseHistory(@Param('id') id: string) {
    return this.fuelExpenseService.getFuelExpenseHistory(id);
  }

  @Get('vehicle/:vehicleId/average')
  async getVehicleAverage(@Param('vehicleId') vehicleId: string) {
    const average = await this.fuelExpenseService.calculateVehicleAverage(vehicleId);
    return average;
  }

  @Post('approval')
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
  async deleteFuelExpense(
    @Request() { user: { id: deletedBy } }: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.fuelExpenseService.delete(id, deletedBy);
  }
}
