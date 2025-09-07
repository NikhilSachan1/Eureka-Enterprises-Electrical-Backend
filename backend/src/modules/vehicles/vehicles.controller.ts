import { Controller, Post, Body, Request, UseInterceptors } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto';
import {
  FIELD_NAMES,
  FILE_UPLOAD_FOLDER_NAMES,
} from '../common/file-upload/constants/files.constants';
import { ApiBearerAuth, ApiBody, ApiTags, ApiConsumes } from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ValidateAndUploadFiles } from '../common/file-upload/decorator/file.decorator';
import { VehicleActionDto } from './dto/vehicle-action.dto';

@ApiTags('Vehicle Management')
@ApiBearerAuth('JWT-auth')
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  @UseInterceptors(FileFieldsInterceptor([{ name: FIELD_NAMES.VEHICLE_FILES, maxCount: 10 }]))
  @ApiConsumes('multipart/form-data')
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
    return this.vehiclesService.create(
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
    return this.vehiclesService.action(
      { ...vehicleActionDto, fromUserId: createdBy },
      vehicleFiles,
      createdBy,
    );
  }
}

// TODO: If required then add multiple types of vehicle documents
