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
import { CreateDsrDto, UpdateDsrDto, GetDsrDto } from './dto';
import { ValidateAndUploadFiles } from '../common/file-upload/decorator/file.decorator';
import {
  FILE_UPLOAD_FOLDER_NAMES,
  FIELD_NAMES,
} from '../common/file-upload/constants/files.constants';
import { DsrUserInterceptor } from './interceptors/dsr-user.interceptor';

@ApiTags('Daily Status Reports')
@ApiBearerAuth('JWT-auth')
@Controller('daily-status-reports')
export class DsrController {
  constructor(private readonly dsrService: DsrService) {}

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

  @Get()
  @UseInterceptors(DsrUserInterceptor)
  @ApiOperation({
    summary: 'Get all DSR entries',
    description: 'Retrieves a list of daily status reports with optional filtering and pagination.',
  })
  async findAll(@Query() query: GetDsrDto) {
    return await this.dsrService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a DSR by ID',
    description: 'Retrieves a specific daily status report by its unique identifier.',
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.dsrService.findById(id);
  }

  @Get(':id/history')
  @ApiOperation({
    summary: 'Get DSR edit history',
    description:
      'Retrieves the edit history for a specific daily status report, showing all changes made over time.',
  })
  async getEditHistory(@Param('id', ParseUUIDPipe) id: string) {
    return await this.dsrService.getEditHistory(id);
  }

  @Get(':id/files')
  @ApiOperation({
    summary: 'Get DSR files',
    description: 'Retrieves all files associated with a specific daily status report.',
  })
  async getFiles(@Param('id', ParseUUIDPipe) id: string) {
    return await this.dsrService.getFiles(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a DSR entry',
    description: 'Updates an existing daily status report with new information.',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: updatedBy } }: { user: { id: string } },
    @Body() updateDto: UpdateDsrDto,
  ) {
    return await this.dsrService.update(id, updateDto, updatedBy);
  }

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

  @Delete('files/:fileId')
  @ApiOperation({
    summary: 'Delete a DSR file',
    description: 'Removes a specific file from a daily status report.',
  })
  async removeFile(@Param('fileId', ParseUUIDPipe) fileId: string) {
    return await this.dsrService.removeFile(fileId);
  }
}
