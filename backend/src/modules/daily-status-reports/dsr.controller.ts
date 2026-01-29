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
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
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
  async findAll(@Query() query: GetDsrDto) {
    return await this.dsrService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.dsrService.findById(id);
  }

  @Get(':id/history')
  async getEditHistory(@Param('id', ParseUUIDPipe) id: string) {
    return await this.dsrService.getEditHistory(id);
  }

  @Get(':id/files')
  async getFiles(@Param('id', ParseUUIDPipe) id: string) {
    return await this.dsrService.getFiles(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: updatedBy } }: { user: { id: string } },
    @Body() updateDto: UpdateDsrDto,
  ) {
    return await this.dsrService.update(id, updateDto, updatedBy);
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: deletedBy } }: { user: { id: string } },
  ) {
    return await this.dsrService.remove(id, deletedBy);
  }

  @Delete('files/:fileId')
  async removeFile(@Param('fileId', ParseUUIDPipe) fileId: string) {
    return await this.dsrService.removeFile(fileId);
  }
}
