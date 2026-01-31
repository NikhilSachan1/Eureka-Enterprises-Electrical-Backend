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
import {
  CreateAssetDto,
  UpdateAssetDto,
  AssetQueryDto,
  BulkDeleteAssetDto,
  AssetListResponseDto,
} from './dto';
import {
  FIELD_NAMES,
  FILE_UPLOAD_FOLDER_NAMES,
} from '../common/file-upload/constants/files.constants';
import {
  ApiBearerAuth,
  ApiBody,
  ApiTags,
  ApiConsumes,
  ApiResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ValidateAndUploadFiles } from '../common/file-upload/decorator/file.decorator';
import { AssetActionDto } from './dto/asset-action.dto';

@ApiTags('Asset Management')
@ApiBearerAuth('JWT-auth')
@Controller('assets')
export class AssetMastersController {
  constructor(private readonly assetMastersService: AssetMastersService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new asset',
    description:
      'Creates a new asset with optional file attachments. Supports multipart/form-data for file uploads.',
  })
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
  @ApiOperation({
    summary: 'Perform an action on an asset',
    description:
      'Executes a specific action on an asset (e.g., approve, reject, transfer) with optional file attachments.',
  })
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
  @ApiOperation({
    summary: 'Get all assets',
    description:
      'Retrieves a paginated list of assets based on query parameters. Supports filtering, sorting, and pagination.',
  })
  @ApiResponse({ status: 200, type: AssetListResponseDto })
  async findAll(@Query() query: AssetQueryDto): Promise<AssetListResponseDto> {
    return await this.assetMastersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get asset details',
    description:
      'Retrieves detailed information about a specific asset by ID, including all related data.',
  })
  async findOne(@Param('id') id: string) {
    return await this.assetMastersService.findOneWithDetails(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update an asset',
    description:
      'Updates an existing asset by ID. Supports partial updates and optional file attachments.',
  })
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
  @ApiOperation({
    summary: 'Delete an asset',
    description: 'Permanently deletes a specific asset by ID. This action cannot be undone.',
  })
  delete(
    @Request() { user: { id: deletedBy } }: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.assetMastersService.delete({ id }, deletedBy);
  }

  @Delete()
  @ApiOperation({
    summary: 'Bulk delete assets',
    description: 'Deletes multiple assets at once based on the provided list of asset IDs.',
  })
  @ApiBody({ type: BulkDeleteAssetDto })
  bulkDeleteAssets(
    @Request() { user: { id: deletedBy, role: userRole } }: { user: { id: string; role: string } },
    @Body() bulkDeleteDto: BulkDeleteAssetDto,
  ) {
    return this.assetMastersService.bulkDeleteAssets({
      ...bulkDeleteDto,
      deletedBy,
      userRole,
    });
  }
}
