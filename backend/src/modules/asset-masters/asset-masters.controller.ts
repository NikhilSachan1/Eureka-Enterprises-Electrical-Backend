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
import { AssetMastersService } from './asset-masters.service';
import { CreateAssetDto, UpdateAssetDto, AssetQueryDto } from './dto';
import {
  FIELD_NAMES,
  FILE_UPLOAD_FOLDER_NAMES,
} from '../common/file-upload/constants/files.constants';
import { ApiBearerAuth, ApiBody, ApiTags, ApiConsumes } from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ValidateAndUploadFiles } from '../common/file-upload/decorator/file.decorator';
import { AssetActionDto } from './dto/asset-action.dto';

@ApiTags('Asset Management')
@ApiBearerAuth('JWT-auth')
@Controller('assets')
export class AssetMastersController {
  constructor(private readonly assetMastersService: AssetMastersService) {}

  @Post()
  @UseInterceptors(FileFieldsInterceptor([{ name: FIELD_NAMES.ASSET_FILES, maxCount: 10 }]))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    type: CreateAssetDto,
    required: true,
  })
  create(
    @Request() { user: { id: createdBy } }: { user: { id: string } },
    @Body() createAssetDto: CreateAssetDto,
    @ValidateAndUploadFiles(FILE_UPLOAD_FOLDER_NAMES.ASSET_FILES)
    { assetFiles }: { assetFiles: string[] } = { assetFiles: [] },
  ) {
    return this.assetMastersService.create(
      {
        ...createAssetDto,
        createdBy,
      },
      assetFiles,
    );
  }

  @Post('action')
  @UseInterceptors(FileFieldsInterceptor([{ name: FIELD_NAMES.ASSET_FILES, maxCount: 10 }]))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    type: AssetActionDto,
    required: true,
  })
  action(
    @Request() { user: { id: createdBy } }: { user: { id: string } },
    @Body() assetActionDto: AssetActionDto,
    @ValidateAndUploadFiles(FILE_UPLOAD_FOLDER_NAMES.ASSET_FILES)
    { assetFiles }: { assetFiles: string[] } = { assetFiles: [] },
  ) {
    return this.assetMastersService.action(
      { ...assetActionDto, fromUserId: createdBy },
      assetFiles,
      createdBy,
    );
  }

  @Get()
  async findAll(@Query() query: AssetQueryDto) {
    return await this.assetMastersService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.assetMastersService.findOneWithDetails(id);
  }

  @Patch(':id')
  @UseInterceptors(FileFieldsInterceptor([{ name: FIELD_NAMES.ASSET_FILES, maxCount: 10 }]))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    type: UpdateAssetDto,
    required: true,
  })
  update(
    @Request() { user: { id: createdBy } }: { user: { id: string } },
    @Param('id') id: string,
    @Body() updateAssetDto: UpdateAssetDto,
    @ValidateAndUploadFiles(FILE_UPLOAD_FOLDER_NAMES.ASSET_FILES)
    { assetFiles }: { assetFiles: string[] } = { assetFiles: [] },
  ) {
    return this.assetMastersService.update({ id }, { ...updateAssetDto, createdBy }, assetFiles);
  }

  @Delete(':id')
  delete(
    @Request() { user: { id: deletedBy } }: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.assetMastersService.delete({ id }, deletedBy);
  }
}

// TODO: If required then add multiple types of asset documents
