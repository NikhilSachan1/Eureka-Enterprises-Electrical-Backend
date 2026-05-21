import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { OrgFilesService } from './org-files.service';
import { CreateFolderDto, GetOrgFilesDto, MoveNodeDto, RenameNodeDto, UploadFileDto } from './dto';
import { ValidateAndUploadFiles } from 'src/modules/common/file-upload/decorator/file.decorator';
import { ORG_FILES_UPLOAD_FOLDER, ORG_FILE_FIELD_NAME } from './constants/org-files.constants';

@ApiTags('Org Files')
@ApiBearerAuth('JWT-auth')
@Controller('org-files')
export class OrgFilesController {
  constructor(private readonly orgFilesService: OrgFilesService) {}

  @Get()
  @ApiOperation({ summary: 'List files and folders (by parentId or root)' })
  async listContents(@Query() filters: GetOrgFilesDto) {
    return this.orgFilesService.listContents(filters);
  }

  @Post('folder')
  @ApiOperation({ summary: 'Create a folder' })
  async createFolder(@Body() dto: CreateFolderDto, @Req() req: { user: { id: string } }) {
    return this.orgFilesService.createFolder(dto, req.user.id);
  }

  @Post('upload')
  @ApiOperation({ summary: 'Upload a file into a folder or root' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadFileDto })
  @UseInterceptors(FileFieldsInterceptor([{ name: ORG_FILE_FIELD_NAME, maxCount: 20 }]))
  async uploadFile(
    @Body() dto: UploadFileDto,
    @Req() req: { user: { id: string }; files: any },
    @ValidateAndUploadFiles(ORG_FILES_UPLOAD_FOLDER)
    uploadedFiles: { orgFileKeys?: string[] },
  ) {
    const rawFiles: Express.Multer.File[] = req.files?.[ORG_FILE_FIELD_NAME] ?? [];
    const storageKeys = uploadedFiles?.orgFileKeys ?? [];

    // Multiple files — upload each and return all created nodes
    if (rawFiles.length > 1) {
      return this.orgFilesService.uploadFiles(
        rawFiles.map((f, i) => ({
          storageKey: storageKeys[i],
          mimeType: f.mimetype ?? null,
          size: f.size ?? null,
          fileName: f.originalname ?? 'file',
        })),
        dto.parentId,
        req.user.id,
      );
    }

    // Single file (backward compatible)
    const rawFile = rawFiles[0];
    const storageKey = storageKeys[0];

    return this.orgFilesService.uploadFile(
      {
        storageKey,
        mimeType: rawFile?.mimetype ?? null,
        size: rawFile?.size ?? null,
      },
      dto.parentId,
      rawFile?.originalname ?? 'file',
      req.user.id,
    );
  }

  @Get(':id/breadcrumb')
  @ApiOperation({ summary: 'Get breadcrumb path from root to the given node' })
  async getBreadcrumb(@Param('id', ParseUUIDPipe) id: string) {
    return this.orgFilesService.getBreadcrumb(id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Get a presigned download URL for a file' })
  async getDownloadUrl(@Param('id', ParseUUIDPipe) id: string) {
    return this.orgFilesService.getDownloadUrl(id);
  }

  @Patch(':id/rename')
  @ApiOperation({ summary: 'Rename a file or folder' })
  async rename(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenameNodeDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.orgFilesService.rename(id, dto, req.user.id);
  }

  @Patch(':id/move')
  @ApiOperation({ summary: 'Move a file or folder to another parent (or root)' })
  async move(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoveNodeDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.orgFilesService.move(id, dto, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a file or folder (recursive for folders)' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: { user: { id: string } }) {
    return this.orgFilesService.remove(id, req.user.id);
  }
}
