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
  @ApiBody({ type: CreateVehicleLogDto })
  @ApiOperation({
    summary: 'Create a vehicle log',
    description:
      'Create with start odometer (STARTED status). Optionally include end odometer to complete in one call.',
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
  async findAll(@Query() query: GetVehicleLogDto) {
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
  @ApiBody({ type: UpdateVehicleLogDto })
  @ApiOperation({
    summary: 'Update a vehicle log',
    description: 'Update start/end entries. Add endOdometerReading to complete a STARTED log.',
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
