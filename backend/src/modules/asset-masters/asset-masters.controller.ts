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
  ForbiddenException,
} from '@nestjs/common';
import { AssetMastersService } from './asset-masters.service';
import {
  CreateAssetDto,
  UpdateAssetDto,
  AssetQueryDto,
  BulkDeleteAssetDto,
  AssetListResponseDto,
  MarkLostDto,
  MarkRecoveredDto,
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
import { Roles } from '../roles/constants/role.constants';

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

  @Get('lost')
  @ApiOperation({
    summary: 'List currently lost assets',
    description:
      'Admin-only. Returns all assets with status = LOST, joined with previous assignee, marked-by user, and recovery expense.',
  })
  async findLost(@Request() req: any) {
    this.assertAdminAccess(req);
    return await this.assetMastersService.findLost();
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

  // ==================== LOST / RECOVERED FLOW ====================

  @Post(':assetMasterId/mark-lost')
  @UseInterceptors(FileFieldsInterceptor([{ name: FIELD_NAMES.ASSET_FILES, maxCount: 10 }]))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: MarkLostDto })
  @ApiOperation({
    summary: 'Mark asset as LOST',
    description:
      'Admin/HR only. Updates asset status to LOST, creates an event with metadata + files, ' +
      'and (if recoveryAmount > 0 and asset was assigned) creates a debit expense on the previous assignee.',
  })
  async markLost(
    @Request() req: any,
    @Param('assetMasterId') assetMasterId: string,
    @Body() dto: MarkLostDto,
    @ValidateAndUploadFiles(FILE_UPLOAD_FOLDER_NAMES.ASSET_FILES)
    { assetFiles }: { assetFiles: string[] } = { assetFiles: [] },
  ) {
    this.assertAdminAccess(req);
    const actorUserId = req?.user?.id;
    return await this.assetMastersService.markLost(assetMasterId, dto, assetFiles, actorUserId);
  }

  @Post(':assetMasterId/mark-recovered')
  @UseInterceptors(FileFieldsInterceptor([{ name: FIELD_NAMES.ASSET_FILES, maxCount: 10 }]))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: MarkRecoveredDto })
  @ApiOperation({
    summary: 'Mark previously LOST asset as RECOVERED',
    description:
      'Admin/HR only. Updates asset status to AVAILABLE, creates a RECOVERED event. ' +
      'If refundRecoveryAmount=true, automatically creates a credit expense reversing the original debit.',
  })
  async markRecovered(
    @Request() req: any,
    @Param('assetMasterId') assetMasterId: string,
    @Body() dto: MarkRecoveredDto,
    @ValidateAndUploadFiles(FILE_UPLOAD_FOLDER_NAMES.ASSET_FILES)
    { assetFiles }: { assetFiles: string[] } = { assetFiles: [] },
  ) {
    this.assertAdminAccess(req);
    const actorUserId = req?.user?.id;
    return await this.assetMastersService.markRecovered(
      assetMasterId,
      dto,
      assetFiles,
      actorUserId,
    );
  }

  // ==================== Helpers ====================

  private assertAdminAccess(req: any): void {
    const role = req?.user?.activeRole || req?.user?.roles?.[0];
    const allowed: string[] = [Roles.SUPER_ADMIN, Roles.ADMIN, Roles.HR];
    if (!allowed.includes(role)) {
      throw new ForbiddenException(
        'Access denied. Only Super Admin, Admin, or HR can perform this action.',
      );
    }
  }
}
