import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Request,
  ParseUUIDPipe,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody, ApiOperation } from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { VehicleLogsService } from './vehicle-logs.service';
import { CreateVehicleLogDto, UpdateVehicleLogDto, GetVehicleLogDto } from './dto';
import { ValidateAndUploadFiles } from '../common/file-upload/decorator/file.decorator';
import {
  FILE_UPLOAD_FOLDER_NAMES,
  FIELD_NAMES,
} from '../common/file-upload/constants/files.constants';
import { VehicleLogUserInterceptor } from './interceptors/vehicle-log-user.interceptor';
import { RequestWithTimezone } from './vehicle-logs.types';
import { Roles } from '../roles/constants/role.constants';

@ApiTags('Vehicle Logs')
@ApiBearerAuth('JWT-auth')
@Controller('vehicle-logs')
export class VehicleLogsController {
  constructor(private readonly vehicleLogsService: VehicleLogsService) {}

  @Post()
  @UseInterceptors(
    VehicleLogUserInterceptor,
    FileFieldsInterceptor([
      { name: FIELD_NAMES.VEHICLE_LOG_START_ODOMETER, maxCount: 2 },
      { name: FIELD_NAMES.VEHICLE_LOG_END_ODOMETER, maxCount: 2 },
      { name: FIELD_NAMES.VEHICLE_LOG_OTHER, maxCount: 5 },
    ]),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        vehicleId: {
          type: 'string',
          format: 'uuid',
          description: 'Vehicle ID (optional for drivers)',
        },
        logDate: {
          type: 'string',
          format: 'date',
          example: '2024-01-15',
          description: 'Log date (YYYY-MM-DD)',
        },
        startOdometerReading: {
          type: 'integer',
          example: 45000,
          description: 'Start odometer reading (km)',
        },
        startTime: { type: 'string', example: '08:30', description: 'Start time (HH:MM)' },
        startLocation: { type: 'string', example: 'Office', description: 'Start location' },
        endOdometerReading: {
          type: 'integer',
          example: 45050,
          description: 'End odometer reading (km) - provide to complete log',
        },
        endTime: { type: 'string', example: '18:30', description: 'End time (HH:MM)' },
        endLocation: { type: 'string', example: 'Site', description: 'End location' },
        purpose: { type: 'string', example: 'Site visit', description: 'Purpose of the trip' },
        driverRemarks: { type: 'string', description: 'Driver remarks' },
        vehicleLogStartOdometer: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Start odometer photo proof (max 2)',
        },
        vehicleLogEndOdometer: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'End odometer photo proof (max 2)',
        },
        vehicleLogOther: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Other supporting files (max 5)',
        },
      },
      required: ['logDate', 'startOdometerReading'],
    },
  })
  @ApiOperation({
    summary: 'Create a vehicle log',
    description:
      'Create with start odometer (STARTED status). Optionally include end odometer to complete in one call. Supports file uploads for odometer proofs.',
  })
  async create(
    @Request() req: RequestWithTimezone,
    @Body() createDto: CreateVehicleLogDto,
    @ValidateAndUploadFiles(FILE_UPLOAD_FOLDER_NAMES.VEHICLE_LOG_FILES)
    uploadedFiles: {
      startOdometerFiles?: string[];
      endOdometerFiles?: string[];
      otherFiles?: string[];
    } = {},
  ) {
    return await this.vehicleLogsService.create(
      createDto,
      req.user.id,
      req.user.role,
      uploadedFiles,
      req.timezone,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Get all vehicle logs with filters',
    description:
      'Use status=STARTED for pending logs. Use includeFiles=true to get files in response.',
  })
  async findAll(@Query() query: GetVehicleLogDto, @Request() req: RequestWithTimezone) {
    // Employees and Drivers can only see their own logs
    if (
      req.user.role !== Roles.HR &&
      req.user.role !== Roles.ADMIN &&
      req.user.role !== Roles.MANAGER &&
      req.user.role !== Roles.SUPER_ADMIN
    ) {
      query.driverId = req.user.id;
    }
    return await this.vehicleLogsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific vehicle log by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.vehicleLogsService.findById(id);
  }

  @Patch(':id')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: FIELD_NAMES.VEHICLE_LOG_START_ODOMETER, maxCount: 2 },
      { name: FIELD_NAMES.VEHICLE_LOG_END_ODOMETER, maxCount: 2 },
      { name: FIELD_NAMES.VEHICLE_LOG_OTHER, maxCount: 5 },
    ]),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        startOdometerReading: {
          type: 'integer',
          example: 45000,
          description: 'Start odometer reading (km)',
        },
        startTime: { type: 'string', example: '08:30', description: 'Start time (HH:MM)' },
        startLocation: { type: 'string', example: 'Office', description: 'Start location' },
        endOdometerReading: {
          type: 'integer',
          example: 45050,
          description: 'End odometer reading (km) - provide to complete log',
        },
        endTime: { type: 'string', example: '18:30', description: 'End time (HH:MM)' },
        endLocation: { type: 'string', example: 'Site', description: 'End location' },
        purpose: { type: 'string', example: 'Site visit', description: 'Purpose of the trip' },
        driverRemarks: { type: 'string', description: 'Driver remarks' },
        managerRemarks: { type: 'string', description: 'Manager remarks' },
        odometerResetFlag: { type: 'boolean', description: 'Odometer reset flag (HR/Admin only)' },
        vehicleLogStartOdometer: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Start odometer photo proof (max 2)',
        },
        vehicleLogEndOdometer: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'End odometer photo proof (max 2)',
        },
        vehicleLogOther: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Other supporting files (max 5)',
        },
      },
    },
  })
  @ApiOperation({
    summary: 'Update a vehicle log',
    description:
      'Update start/end entries. Add endOdometerReading to complete a STARTED log. Supports file uploads.',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: RequestWithTimezone,
    @Body() updateDto: UpdateVehicleLogDto,
    @ValidateAndUploadFiles(FILE_UPLOAD_FOLDER_NAMES.VEHICLE_LOG_FILES)
    uploadedFiles: {
      startOdometerFiles?: string[];
      endOdometerFiles?: string[];
      otherFiles?: string[];
    } = {},
  ) {
    return await this.vehicleLogsService.update(
      id,
      updateDto,
      req.user.id,
      req.user.role,
      uploadedFiles,
      req.timezone,
    );
  }
}
