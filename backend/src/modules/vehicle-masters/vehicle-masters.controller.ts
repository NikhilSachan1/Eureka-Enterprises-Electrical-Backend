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
import { ApiBearerAuth, ApiBody, ApiTags, ApiConsumes } from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ValidateAndUploadFiles } from '../common/file-upload/decorator/file.decorator';
import { VehicleActionDto } from './dto/vehicle-action.dto';

@ApiTags('Vehicle Management')
@ApiBearerAuth('JWT-auth')
@Controller('vehicles')
export class VehicleMastersController {
  constructor(private readonly vehicleMastersService: VehicleMastersService) {}

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
  async findAll(@Query() query: VehicleQueryDto) {
    return await this.vehicleMastersService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.vehicleMastersService.findById(id);
  }

  @Patch(':id')
  @UseInterceptors(FileFieldsInterceptor([{ name: FIELD_NAMES.VEHICLE_FILES, maxCount: 10 }]))
  @ApiConsumes('multipart/form-data')
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
  delete(
    @Request() { user: { id: deletedBy } }: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.vehicleMastersService.delete({ id }, deletedBy);
  }
}
