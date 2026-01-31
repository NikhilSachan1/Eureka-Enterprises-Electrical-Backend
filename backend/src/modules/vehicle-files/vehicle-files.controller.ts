import { Body, Controller, Post, UseInterceptors, Request } from '@nestjs/common';
import { VehicleFilesService } from './vehicle-files.service';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags, ApiOperation } from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  FIELD_NAMES,
  FILE_UPLOAD_FOLDER_NAMES,
} from '../common/file-upload/constants/files.constants';
import { ValidateAndUploadFiles } from '../common/file-upload/decorator/file.decorator';
import { UpdateVehicleFileDto } from './dto/update-vehicle-file.dto';

@ApiTags('Vehicle Events')
@ApiBearerAuth('JWT-auth')
@Controller('vehicle-files')
export class VehicleFilesController {
  constructor(private readonly vehicleFilesService: VehicleFilesService) {}

  @Post()
  @UseInterceptors(FileFieldsInterceptor([{ name: FIELD_NAMES.VEHICLE_FILES, maxCount: 10 }]))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload vehicle files',
    description:
      'Uploads and associates files with a vehicle. Supports multiple file uploads up to 10 files.',
  })
  @ApiBody({
    type: UpdateVehicleFileDto,
    required: true,
  })
  create(
    @Request() { user: { id: createdBy } }: { user: { id: string } },
    @Body() updateVehicleFileDto: UpdateVehicleFileDto,
    @ValidateAndUploadFiles(FILE_UPLOAD_FOLDER_NAMES.VEHICLE_FILES)
    { vehicleFiles }: { vehicleFiles: string[] } = { vehicleFiles: [] },
  ) {
    return this.vehicleFilesService.create({
      ...updateVehicleFileDto,
      createdBy,
      fileKeys: vehicleFiles,
    });
  }
}
