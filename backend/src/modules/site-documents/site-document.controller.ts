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
import { SiteDocumentService } from './site-document.service';
import {
  CreateSiteDocumentDto,
  UpdateSiteDocumentDto,
  GetSiteDocumentDto,
  BulkCreateSiteDocumentDto,
} from './dto';
import { ValidateAndUploadFiles } from '../common/file-upload/decorator/file.decorator';
import {
  FILE_UPLOAD_FOLDER_NAMES,
  FIELD_NAMES,
} from '../common/file-upload/constants/files.constants';

@ApiTags('Site Documents')
@ApiBearerAuth('JWT-auth')
@Controller('site-documents')
export class SiteDocumentController {
  constructor(private readonly siteDocumentService: SiteDocumentService) {}

  @Post()
  @UseInterceptors(FileFieldsInterceptor([{ name: FIELD_NAMES.SITE_DOCUMENT_FILES, maxCount: 1 }]))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateSiteDocumentDto })
  @ApiOperation({
    summary: 'Create a new site document',
    description:
      'Creates a new site document with file upload. Supports uploading a single document file along with document metadata.',
  })
  async create(
    @Request() { user: { id: createdBy } }: { user: { id: string } },
    @Body() createDto: CreateSiteDocumentDto,
    @ValidateAndUploadFiles(FILE_UPLOAD_FOLDER_NAMES.SITE_DOCUMENT_FILES)
    uploadedFiles: { fileKeys: string[] } = { fileKeys: [] },
  ) {
    const fileKey = uploadedFiles?.fileKeys?.[0] || null;
    return await this.siteDocumentService.create(createDto, createdBy, fileKey);
  }

  @Post('bulk')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: FIELD_NAMES.SITE_DOC_PO, maxCount: 1 },
      { name: FIELD_NAMES.SITE_DOC_INVOICE, maxCount: 1 },
      { name: FIELD_NAMES.SITE_DOC_CONTRACT, maxCount: 1 },
      { name: FIELD_NAMES.SITE_DOC_WORK_ORDER, maxCount: 1 },
      { name: FIELD_NAMES.SITE_DOC_COMPLETION_CERTIFICATE, maxCount: 1 },
      { name: FIELD_NAMES.SITE_DOC_OTHER, maxCount: 1 },
    ]),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: BulkCreateSiteDocumentDto })
  @ApiOperation({
    summary: 'Bulk create site documents',
    description:
      'Creates multiple site documents at once with different document types (PO, Invoice, Contract, Work Order, Completion Certificate, Other). Each document type can have its own file upload.',
  })
  async bulkCreate(
    @Request() { user: { id: createdBy } }: { user: { id: string } },
    @Body() bulkDto: BulkCreateSiteDocumentDto,
    @ValidateAndUploadFiles(FILE_UPLOAD_FOLDER_NAMES.SITE_DOCUMENT_FILES)
    uploadedFiles: { fileKeys: string[]; fieldFileKeys?: Record<string, string> } = {
      fileKeys: [],
    },
  ) {
    // Map field names to their file keys
    const fileKeys: Record<string, string> = uploadedFiles.fieldFileKeys || {};
    return await this.siteDocumentService.bulkCreate(bulkDto, createdBy, fileKeys);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all site documents',
    description:
      'Retrieves a list of all site documents with optional filtering, pagination, and sorting based on query parameters.',
  })
  async findAll(@Query() query: GetSiteDocumentDto) {
    return await this.siteDocumentService.findAll(query);
  }

  @Get('site/:siteId')
  @ApiOperation({
    summary: 'Get documents by site ID',
    description:
      'Retrieves all documents associated with a specific site, with optional filtering and pagination.',
  })
  async getDocumentsBySite(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Query() query: GetSiteDocumentDto,
  ) {
    return await this.siteDocumentService.getDocumentsBySite(siteId, query);
  }

  @Get('contractor/:contractorId')
  @ApiOperation({
    summary: 'Get documents by contractor ID',
    description:
      'Retrieves all documents associated with a specific contractor, with optional filtering and pagination.',
  })
  async getDocumentsByContractor(
    @Param('contractorId', ParseUUIDPipe) contractorId: string,
    @Query() query: GetSiteDocumentDto,
  ) {
    return await this.siteDocumentService.getDocumentsByContractor(contractorId, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a site document by ID',
    description:
      'Retrieves detailed information about a specific site document by its unique identifier.',
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.siteDocumentService.findById(id);
  }

  @Patch(':id')
  @UseInterceptors(FileFieldsInterceptor([{ name: FIELD_NAMES.SITE_DOCUMENT_FILES, maxCount: 1 }]))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateSiteDocumentDto })
  @ApiOperation({
    summary: 'Update a site document',
    description:
      'Updates the details of an existing site document. Optionally allows updating the document file. Only provided fields will be updated.',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: updatedBy } }: { user: { id: string } },
    @Body() updateDto: UpdateSiteDocumentDto,
    @ValidateAndUploadFiles(FILE_UPLOAD_FOLDER_NAMES.SITE_DOCUMENT_FILES)
    uploadedFiles: { fileKeys: string[] } = { fileKeys: [] },
  ) {
    const fileKey = uploadedFiles?.fileKeys?.[0] || undefined;
    return await this.siteDocumentService.update(id, updateDto, updatedBy, fileKey);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a site document',
    description:
      'Soft deletes a site document by marking it as deleted. The document can be restored later if needed.',
  })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: deletedBy } }: { user: { id: string } },
  ) {
    return await this.siteDocumentService.remove(id, deletedBy);
  }

  @Post(':id/restore')
  @ApiOperation({
    summary: 'Restore a deleted site document',
    description: 'Restores a previously soft-deleted site document, making it active again.',
  })
  async restore(@Param('id', ParseUUIDPipe) id: string) {
    return await this.siteDocumentService.restore(id);
  }
}
