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
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
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
  async findAll(@Query() query: VehicleServiceQueryDto) {
    return await this.vehicleServicesService.findAll(query);
  }

  @Get('analytics')
  async getAnalytics(@Query() query: ServiceAnalyticsQueryDto) {
    return await this.vehicleServicesService.getServiceAnalytics(query);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.vehicleServicesService.findOneOrFail({
      where: { id },
      relations: ['serviceFiles'],
    });
  }

  @Patch(':id')
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
  async delete(
    @Request() { user: { id: deletedBy } }: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return await this.vehicleServicesService.delete({ id }, deletedBy);
  }
}
