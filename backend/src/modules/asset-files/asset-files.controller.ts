import { Body, Controller, Post, UseInterceptors, Request } from '@nestjs/common';
import { AssetFilesService } from './asset-files.service';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  FIELD_NAMES,
  FILE_UPLOAD_FOLDER_NAMES,
} from '../common/file-upload/constants/files.constants';
import { ValidateAndUploadFiles } from '../common/file-upload/decorator/file.decorator';
import { UpdateAssetFileDto } from './dto/update-asset-file.dto';

@ApiTags('Asset Events')
@ApiBearerAuth('JWT-auth')
@Controller('asset-files')
export class AssetFilesController {
  constructor(private readonly assetFilesService: AssetFilesService) {}

  @Post()
  @UseInterceptors(FileFieldsInterceptor([{ name: FIELD_NAMES.ASSET_FILES, maxCount: 10 }]))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    type: UpdateAssetFileDto,
    required: true,
  })
  create(
    @Request() { user: { id: createdBy } }: { user: { id: string } },
    @Body() updateAssetFileDto: UpdateAssetFileDto,
    @ValidateAndUploadFiles(FILE_UPLOAD_FOLDER_NAMES.ASSET_FILES)
    { assetFiles }: { assetFiles: string[] } = { assetFiles: [] },
  ) {
    return this.assetFilesService.create({
      ...updateAssetFileDto,
      createdBy,
      fileKeys: assetFiles,
    });
  }
}
