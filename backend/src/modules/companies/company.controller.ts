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
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody, ApiOperation } from '@nestjs/swagger';
import { CompanyService } from './company.service';
import { CreateCompanyDto, UpdateCompanyDto, GetCompanyDto, BulkDeleteCompanyDto } from './dto';
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
  @ApiOperation({
    summary: 'Create a company',
    description: 'Creates a new company record in the system. Supports logo file upload.',
  })
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
  @ApiOperation({
    summary: 'Get all companies',
    description: 'Retrieves a list of companies with optional filtering and pagination.',
  })
  async findAll(@Query() query: GetCompanyDto) {
    return await this.companyService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a company by ID',
    description:
      'Retrieves a specific company by its unique identifier. Optionally includes child companies.',
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('includeChildren') includeChildren?: boolean,
  ) {
    return await this.companyService.findById(id, includeChildren);
  }

  @Get(':id/hierarchy')
  @ApiOperation({
    summary: 'Get company hierarchy',
    description:
      'Retrieves the complete organizational hierarchy for a specific company, including parent and child relationships.',
  })
  async getHierarchy(@Param('id', ParseUUIDPipe) id: string) {
    return await this.companyService.getHierarchy(id);
  }

  @Patch(':id')
  @UseInterceptors(FileFieldsInterceptor([{ name: FIELD_NAMES.COMPANY_LOGO, maxCount: 1 }]))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateCompanyDto })
  @ApiOperation({
    summary: 'Update a company',
    description:
      'Updates an existing company record with new information. Supports logo file upload.',
  })
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

  @Delete()
  @ApiOperation({
    summary: 'Bulk delete companies',
    description: 'Deletes multiple companies in bulk based on the provided company IDs.',
  })
  @ApiBody({ type: BulkDeleteCompanyDto })
  async bulkDelete(
    @Request() { user: { id: deletedBy } }: { user: { id: string } },
    @Body() bulkDeleteDto: BulkDeleteCompanyDto,
  ) {
    return await this.companyService.bulkDelete(bulkDeleteDto.companyIds, deletedBy);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a company',
    description: 'Soft deletes a company by its unique identifier.',
  })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: deletedBy } }: { user: { id: string } },
  ) {
    return await this.companyService.remove(id, deletedBy);
  }

  @Post(':id/restore')
  @ApiOperation({
    summary: 'Restore a deleted company',
    description: 'Restores a previously soft-deleted company back to active status.',
  })
  async restore(@Param('id', ParseUUIDPipe) id: string) {
    return await this.companyService.restore(id);
  }
}
