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
  UseInterceptors,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { CompanyService } from './company.service';
import { CreateCompanyDto, UpdateCompanyDto, GetCompanyDto } from './dto';
import { ValidateAndUploadFiles } from '../common/file-upload/decorator/file.decorator';
import {
  FILE_UPLOAD_FOLDER_NAMES,
  FIELD_NAMES,
} from '../common/file-upload/constants/files.constants';

@ApiTags('Companies')
@ApiBearerAuth('JWT-auth')
@Controller('companies')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Post()
  @UseInterceptors(FileFieldsInterceptor([{ name: FIELD_NAMES.COMPANY_LOGO, maxCount: 1 }]))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateCompanyDto })
  async create(
    @Request() { user: { id: createdBy } }: { user: { id: string } },
    @Body() createCompanyDto: CreateCompanyDto,
    @ValidateAndUploadFiles(FILE_UPLOAD_FOLDER_NAMES.COMPANY_LOGOS)
    uploadedFiles: { fileKeys: string[] } = { fileKeys: [] },
  ) {
    const logoKey = uploadedFiles?.fileKeys?.[0] || null;
    return await this.companyService.create(createCompanyDto, createdBy, logoKey);
  }

  @Get()
  async findAll(@Query() query: GetCompanyDto) {
    return await this.companyService.findAll(query);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('includeChildren') includeChildren?: boolean,
  ) {
    return await this.companyService.findById(id, includeChildren);
  }

  @Get(':id/hierarchy')
  async getHierarchy(@Param('id', ParseUUIDPipe) id: string) {
    return await this.companyService.getHierarchy(id);
  }

  @Patch(':id')
  @UseInterceptors(FileFieldsInterceptor([{ name: FIELD_NAMES.COMPANY_LOGO, maxCount: 1 }]))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateCompanyDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: updatedBy } }: { user: { id: string } },
    @Body() updateCompanyDto: UpdateCompanyDto,
    @ValidateAndUploadFiles(FILE_UPLOAD_FOLDER_NAMES.COMPANY_LOGOS)
    uploadedFiles: { fileKeys: string[] } = { fileKeys: [] },
  ) {
    const logoKey = uploadedFiles?.fileKeys?.[0] || undefined;
    return await this.companyService.update(id, updateCompanyDto, updatedBy, logoKey);
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: deletedBy } }: { user: { id: string } },
  ) {
    return await this.companyService.remove(id, deletedBy);
  }

  @Post(':id/restore')
  async restore(@Param('id', ParseUUIDPipe) id: string) {
    return await this.companyService.restore(id);
  }
}
