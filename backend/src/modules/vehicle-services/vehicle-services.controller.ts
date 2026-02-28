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
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody, ApiOperation } from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { VehicleServicesService } from './vehicle-services.service';
import {
  CreateVehicleServiceDto,
  UpdateVehicleServiceDto,
  VehicleServiceQueryDto,
  ServiceAnalyticsQueryDto,
  BulkDeleteVehicleServiceDto,
} from './dto';
import {
  FIELD_NAMES,
  FILE_UPLOAD_FOLDER_NAMES,
} from '../common/file-upload/constants/files.constants';
import { ValidateAndUploadFiles } from '../common/file-upload/decorator/file.decorator';
import { RequestWithTimezone } from './vehicle-services.types';
@ApiTags('Vehicle Services')
@ApiBearerAuth('JWT-auth')
@Controller('vehicle-service')
export class VehicleServicesController {
  constructor(private readonly vehicleServicesService: VehicleServicesService) {}

  @Post()
  @UseInterceptors(FileFieldsInterceptor([{ name: FIELD_NAMES.SERVICE_FILES, maxCount: 10 }]))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Create vehicle service record',
    description:
      'Creates a new vehicle service record with service details and optional file uploads (invoices, receipts, etc.).',
  })
  @ApiBody({
    description: 'Create vehicle service record with optional file uploads',
    schema: {
      type: 'object',
      properties: {
        vehicleMasterId: {
          type: 'string',
          format: 'uuid',
          example: '123e4567-e89b-12d3-a456-426614174000',
        },
        serviceDate: { type: 'string', format: 'date', example: '2024-01-15' },
        odometerReading: { type: 'number', example: 45000 },
        serviceType: { type: 'string', example: 'REGULAR_SERVICE' },
        serviceDetails: { type: 'string', example: 'Oil change, filter replacement' },
        serviceCenterName: { type: 'string', example: 'ABC Service Center' },
        serviceCost: { type: 'number', example: 5000 },
        serviceStatus: { type: 'string', example: 'COMPLETED' },
        remarks: { type: 'string', example: 'Vehicle in good condition' },
        serviceFiles: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
      required: ['vehicleMasterId', 'serviceDate', 'odometerReading', 'serviceType'],
    },
  })
  async create(
    @Request() req: RequestWithTimezone,
    @Body() createDto: CreateVehicleServiceDto,
    @ValidateAndUploadFiles(FILE_UPLOAD_FOLDER_NAMES.VEHICLE_SERVICE_FILES)
    { serviceFiles }: { serviceFiles: string[] } = { serviceFiles: [] },
  ) {
    return await this.vehicleServicesService.create(
      { ...createDto, createdBy: req.user.id },
      serviceFiles,
      req.timezone,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Get all vehicle services',
    description:
      'Retrieves a list of vehicle service records based on query parameters. Supports filtering, pagination, and sorting.',
  })
  async findAll(@Query() query: VehicleServiceQueryDto) {
    return await this.vehicleServicesService.findAll(query);
  }

  @Get('analytics')
  @ApiOperation({
    summary: 'Get service analytics',
    description:
      'Retrieves analytics and statistics about vehicle services, including costs, frequency, and trends.',
  })
  async getAnalytics(@Query() query: ServiceAnalyticsQueryDto) {
    return await this.vehicleServicesService.getServiceAnalytics(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get vehicle service details',
    description:
      'Retrieves detailed information about a specific vehicle service record by its ID, including associated files.',
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.vehicleServicesService.getServiceById(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update vehicle service record',
    description: 'Updates an existing vehicle service record with new information.',
  })
  async update(
    @Request() req: RequestWithTimezone,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateVehicleServiceDto,
  ) {
    return await this.vehicleServicesService.update(
      { id },
      { ...updateDto, updatedBy: req.user.id },
      req.timezone,
    );
  }

  @Delete('bulk')
  @ApiOperation({
    summary: 'Bulk delete vehicle services',
    description:
      'Deletes multiple vehicle service records at once based on the provided list of service IDs.',
  })
  async bulkDeleteServices(
    @Request() { user: { id: deletedBy } }: { user: { id: string } },
    @Body() bulkDeleteDto: BulkDeleteVehicleServiceDto,
  ) {
    return await this.vehicleServicesService.bulkDeleteServices({
      ...bulkDeleteDto,
      deletedBy,
    });
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete vehicle service record',
    description: 'Permanently deletes a specific vehicle service record by its ID.',
  })
  async delete(
    @Request() { user: { id: deletedBy } }: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return await this.vehicleServicesService.delete({ id }, deletedBy);
  }
}
