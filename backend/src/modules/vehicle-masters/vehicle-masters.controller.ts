import {
  Controller,
  Post,
  Body,
  Request,
  UseInterceptors,
  Patch,
  Param,
  Delete,
  Query,
  Get,
} from '@nestjs/common';
import { VehicleMastersService } from './vehicle-masters.service';
import { CreateVehicleDto, UpdateVehicleDto, VehicleQueryDto, BulkDeleteVehicleDto } from './dto';
import {
  FIELD_NAMES,
  FILE_UPLOAD_FOLDER_NAMES,
} from '../common/file-upload/constants/files.constants';
import {
  ApiBearerAuth,
  ApiBody,
  ApiTags,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ValidateAndUploadFiles } from '../common/file-upload/decorator/file.decorator';
import { VehicleActionDto } from './dto/vehicle-action.dto';
import { VehicleUserInterceptor } from './interceptors/vehicle-user.interceptor';

@ApiTags('Vehicle Management')
@ApiBearerAuth('JWT-auth')
@Controller('vehicles')
export class VehicleMastersController {
  constructor(private readonly vehicleMastersService: VehicleMastersService) {}

  @Post()
  @UseInterceptors(FileFieldsInterceptor([{ name: FIELD_NAMES.VEHICLE_FILES, maxCount: 10 }]))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Create a new vehicle',
    description:
      'Creates a new vehicle record with optional file uploads. Supports multipart/form-data for file attachments.',
  })
  @ApiBody({
    type: CreateVehicleDto,
    required: true,
  })
  create(
    @Request() { user: { id: createdBy } }: { user: { id: string } },
    @Body() createVehicleDto: CreateVehicleDto,
    @ValidateAndUploadFiles(FILE_UPLOAD_FOLDER_NAMES.VEHICLE_FILES)
    { vehicleFiles }: { vehicleFiles: string[] } = { vehicleFiles: [] },
  ) {
    return this.vehicleMastersService.create(
      {
        ...createVehicleDto,
        createdBy,
      },
      vehicleFiles,
    );
  }

  @Post('action')
  @UseInterceptors(FileFieldsInterceptor([{ name: FIELD_NAMES.VEHICLE_FILES, maxCount: 10 }]))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Perform vehicle action',
    description:
      'Executes a specific action on a vehicle (e.g., transfer, status change) with optional file uploads.',
  })
  @ApiBody({
    type: VehicleActionDto,
    required: true,
  })
  action(
    @Request() { user: { id: createdBy } }: { user: { id: string } },
    @Body() vehicleActionDto: VehicleActionDto,
    @ValidateAndUploadFiles(FILE_UPLOAD_FOLDER_NAMES.VEHICLE_FILES)
    { vehicleFiles }: { vehicleFiles: string[] } = { vehicleFiles: [] },
  ) {
    return this.vehicleMastersService.action(
      { ...vehicleActionDto, fromUserId: createdBy },
      vehicleFiles,
      createdBy,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Get all vehicles',
    description:
      'Retrieves a list of vehicles based on query parameters. Supports filtering, pagination, and sorting.',
  })
  async findAll(@Query() query: VehicleQueryDto) {
    return await this.vehicleMastersService.findAll(query);
  }

  @Get('assigned')
  @UseInterceptors(VehicleUserInterceptor)
  @ApiOperation({
    summary: 'Get assigned vehicle',
    description:
      'Retrieves the vehicle assigned to a user along with the associated card details. For DRIVER/EMPLOYEE roles, returns their own assigned vehicle. For other roles, userId can be specified.',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'User ID (optional for ADMIN/HR, ignored for DRIVER/EMPLOYEE)',
  })
  async getAssignedVehicle(@Query('userId') userId: string) {
    return await this.vehicleMastersService.getAssignedVehicle(userId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get vehicle details',
    description: 'Retrieves detailed information about a specific vehicle by its ID.',
  })
  async findOne(@Param('id') id: string) {
    return await this.vehicleMastersService.findById(id);
  }

  @Patch(':id')
  @UseInterceptors(FileFieldsInterceptor([{ name: FIELD_NAMES.VEHICLE_FILES, maxCount: 10 }]))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Update vehicle information',
    description:
      'Updates an existing vehicle record with new information and optional file uploads.',
  })
  @ApiBody({
    type: UpdateVehicleDto,
    required: true,
  })
  update(
    @Request() { user: { id: updatedBy } }: { user: { id: string } },
    @Param('id') id: string,
    @Body() updateVehicleDto: UpdateVehicleDto,
    @ValidateAndUploadFiles(FILE_UPLOAD_FOLDER_NAMES.VEHICLE_FILES)
    { vehicleFiles }: { vehicleFiles: string[] } = { vehicleFiles: [] },
  ) {
    return this.vehicleMastersService.update(
      { id },
      { ...updateVehicleDto, updatedBy },
      vehicleFiles,
    );
  }

  @Delete()
  @ApiOperation({
    summary: 'Bulk delete vehicles',
    description: 'Deletes multiple vehicles at once based on the provided list of vehicle IDs.',
  })
  bulkDeleteVehicles(
    @Request() { user: { id: deletedBy, role: userRole } }: { user: { id: string; role: string } },
    @Body() bulkDeleteDto: BulkDeleteVehicleDto,
  ) {
    return this.vehicleMastersService.bulkDeleteVehicles({
      ...bulkDeleteDto,
      deletedBy,
      userRole,
    });
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a vehicle',
    description: 'Permanently deletes a specific vehicle by its ID.',
  })
  delete(
    @Request() { user: { id: deletedBy } }: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.vehicleMastersService.delete({ id }, deletedBy);
  }
}
