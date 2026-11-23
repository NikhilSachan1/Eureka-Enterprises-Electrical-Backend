import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  ParseUUIDPipe,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody, ApiOperation } from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { DsrService } from './dsr.service';
import {
  CreateDsrDto,
  ForceCreateDsrDto,
  UpdateDsrDto,
  GetDsrDto,
  GetDsrProjectSummaryDto,
} from './dto';
import { ValidateAndUploadFiles } from '../common/file-upload/decorator/file.decorator';
import {
  FILE_UPLOAD_FOLDER_NAMES,
  FIELD_NAMES,
} from '../common/file-upload/constants/files.constants';
import { DsrUserInterceptor } from './interceptors/dsr-user.interceptor';
import { RequiredAnyPermission } from 'src/modules/auth/decorators/required-permission.decorator';

@ApiTags('Daily Status Reports')
@ApiBearerAuth('JWT-auth')
@Controller('daily-status-reports')
export class DsrController {
  constructor(private readonly dsrService: DsrService) {}

  @RequiredAnyPermission('project.dsr.add')
  @Post()
  @UseInterceptors(FileFieldsInterceptor([{ name: FIELD_NAMES.DSR_FILES, maxCount: 5 }]))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateDsrDto })
  @ApiOperation({
    summary: 'Create a DSR entry',
    description:
      'Creates a daily status report for a specific site. Supports file uploads (up to 5 files).',
  })
  async create(
    @Request() { user: { id: userId } }: { user: { id: string } },
    @Body() createDto: CreateDsrDto,
    @ValidateAndUploadFiles(FILE_UPLOAD_FOLDER_NAMES.DSR_FILES)
    uploadedFiles: { fileKeys: string[] } = { fileKeys: [] },
  ) {
    return await this.dsrService.create(createDto, userId, uploadedFiles.fileKeys);
  }

  @RequiredAnyPermission('project.dsr.force')
  @Post('force')
  @UseInterceptors(FileFieldsInterceptor([{ name: FIELD_NAMES.DSR_FILES, maxCount: 5 }]))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: ForceCreateDsrDto })
  @ApiOperation({
    summary: 'Force create a DSR entry',
    description:
      'Creates a daily status report without requiring the user to be allocated to the site. Optional userId targets another employee (SUPER_ADMIN, HR, ADMIN, or MANAGER only). Equipment IDs are validated for existence only.',
  })
  async forceCreate(
    @Request() { user: { id: userId, role } }: { user: { id: string; role: string } },
    @Body() forceDto: ForceCreateDsrDto,
    @ValidateAndUploadFiles(FILE_UPLOAD_FOLDER_NAMES.DSR_FILES)
    uploadedFiles: { fileKeys: string[] } = { fileKeys: [] },
  ) {
    return await this.dsrService.forceCreate(forceDto, userId, role, uploadedFiles.fileKeys);
  }

  @RequiredAnyPermission('project.dsr.view-list')
  @Get()
  @UseInterceptors(DsrUserInterceptor)
  @ApiOperation({
    summary: 'Get all DSR entries',
    description: 'Retrieves a list of daily status reports with optional filtering and pagination.',
  })
  async findAll(
    @Request() { user: { id: userId, activeRole } }: { user: { id: string; activeRole?: string } },
    @Query() query: GetDsrDto,
  ) {
    return await this.dsrService.findAll(query, userId, activeRole);
  }

  // Declared before ':id' so "summary" is not read as an id.
  @RequiredAnyPermission('project.dsr.view-list')
  @Get('summary/projects')
  @UseInterceptors(DsrUserInterceptor)
  @ApiOperation({
    summary: 'DSR summary per project',
    description:
      'One row per project: days someone was allocated, days with a DSR, missing days, reporters and the last report. Roles limited to their own DSRs get their own figures. Paged on the server.',
  })
  async getProjectSummary(
    @Request() { user: { id: userId, activeRole } }: { user: { id: string; activeRole?: string } },
    @Query() query: GetDsrProjectSummaryDto,
  ) {
    return await this.dsrService.getProjectSummary(query, userId, activeRole);
  }

  @RequiredAnyPermission('project.dsr.view-detail', 'project.dsr.view-list', 'project.dsr.edit')
  @Get(':id')
  @ApiOperation({
    summary: 'Get a DSR by ID',
    description: 'Retrieves a specific daily status report by its unique identifier.',
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.dsrService.findById(id);
  }

  @RequiredAnyPermission('project.dsr.view-detail', 'project.dsr.view-list', 'project.dsr.edit')
  @Get(':id/history')
  @ApiOperation({
    summary: 'Get DSR edit history',
    description:
      'Retrieves the edit history for a specific daily status report, showing all changes made over time.',
  })
  async getEditHistory(@Param('id', ParseUUIDPipe) id: string) {
    return await this.dsrService.getEditHistory(id);
  }

  @RequiredAnyPermission('project.dsr.view-detail', 'project.dsr.view-list', 'project.dsr.edit')
  @Get(':id/versions')
  @ApiOperation({
    summary: 'Get DSR version history',
    description:
      'Retrieves all versions of a daily status report, including current and previous versions with their full data.',
  })
  async getVersionHistory(@Param('id', ParseUUIDPipe) id: string) {
    return await this.dsrService.getVersionHistory(id);
  }

  @RequiredAnyPermission('project.dsr.view-detail', 'project.dsr.view-list', 'project.dsr.edit')
  @Get(':id/files')
  @ApiOperation({
    summary: 'Get DSR files',
    description: 'Retrieves all files associated with a specific daily status report.',
  })
  async getFiles(@Param('id', ParseUUIDPipe) id: string) {
    return await this.dsrService.getFiles(id);
  }

  @RequiredAnyPermission('project.dsr.edit')
  @Patch(':id')
  @UseInterceptors(FileFieldsInterceptor([{ name: FIELD_NAMES.DSR_FILES, maxCount: 5 }]))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateDsrDto })
  @ApiOperation({
    summary: 'Update a DSR entry',
    description:
      'Updates an existing daily status report with new information. Supports adding new files (up to 5 files).',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: updatedBy } }: { user: { id: string } },
    @Body() updateDto: UpdateDsrDto,
    @ValidateAndUploadFiles(FILE_UPLOAD_FOLDER_NAMES.DSR_FILES)
    uploadedFiles: { fileKeys: string[] } = { fileKeys: [] },
  ) {
    return await this.dsrService.update(id, updateDto, updatedBy, uploadedFiles.fileKeys);
  }

  @RequiredAnyPermission('project.dsr.delete')
  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a DSR entry',
    description: 'Soft deletes a daily status report by its unique identifier.',
  })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: deletedBy } }: { user: { id: string } },
  ) {
    return await this.dsrService.remove(id, deletedBy);
  }

  @RequiredAnyPermission('project.dsr.edit', 'project.dsr.delete')
  @Delete('files/:fileId')
  @ApiOperation({
    summary: 'Delete a DSR file',
    description: 'Removes a specific file from a daily status report.',
  })
  async removeFile(@Param('fileId', ParseUUIDPipe) fileId: string) {
    return await this.dsrService.removeFile(fileId);
  }
}
