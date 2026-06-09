import {
  Controller,
  Get,
  Post,
  Query,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FilesService } from './files.service';
import { FILE_UPLOAD_FOLDER_NAMES, FIELD_NAMES } from './constants/files.constants';
import { validateFileUploads } from './validators/files.validator';

@ApiTags('Files')
@Controller('files')
@ApiBearerAuth('JWT-auth')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get()
  @ApiOperation({
    summary: 'Get file download URL',
    description:
      'Retrieves a signed download URL for a file stored in the system using the file key.',
  })
  async getDownloadFileUrl(@Query('key') key: string) {
    return await this.filesService.getDownloadFileUrl(key);
  }

  /**
   * Generic upload endpoint for financial-module document attachments.
   *
   * Every financial document (PO, JMC, Invoice, Report, BankTransfer proof,
   * Debit/Credit Note) requires exactly one attachment. Call this endpoint
   * first; receive { fileKey, fileName }; include both values in the
   * financial document create/update body.
   *
   * Supported: PDF, JPEG, PNG (≤ 10 MB).
   */
  @Post('financial-upload')
  @UseInterceptors(FileInterceptor(FIELD_NAMES.FINANCIAL_FILE))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['financialFile'],
      properties: {
        financialFile: {
          type: 'string',
          format: 'binary',
          description: 'PDF or image for a financial document (max 10 MB)',
        },
      },
    },
  })
  @ApiOperation({
    summary: 'Upload a financial document attachment',
    description:
      'Uploads one PDF/image to S3. Returns { fileKey, fileName }. Use the returned values ' +
      'in the fileKey/fileName fields of any financial document create body ' +
      '(PO, JMC, Invoice, Report, BankTransfer, DebitNote, CreditNote).',
  })
  async uploadFinancialFile(
    @Request() req: { user: { id: string } },
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException(
        'No file uploaded. Provide a PDF or image in the "financialFile" field.',
      );
    }

    const [validated] = validateFileUploads([file], FILE_UPLOAD_FOLDER_NAMES.FINANCIAL_FILES);

    const fileKey = await this.filesService.uploadFile(
      validated.fileStream,
      validated.key,
      validated.mimetype,
    );

    return { fileKey, fileName: file.originalname };
  }

  /**
   * Upload endpoint for site report attachments.
   *
   * Supports PDF, JPEG, PNG and all archive formats (zip, rar, 7z, gz, tar, bz2).
   * Maximum file size: 50 MB.
   * Returns { fileKey, fileName } — include in the site report create/update body.
   */
  @Post('site-report-upload')
  @UseInterceptors(FileInterceptor(FIELD_NAMES.SITE_REPORT_FILE))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['siteReportFile'],
      properties: {
        siteReportFile: {
          type: 'string',
          format: 'binary',
          description: 'PDF, image, or archive (zip/rar/7z/gz) for a site report (max 50 MB)',
        },
      },
    },
  })
  @ApiOperation({
    summary: 'Upload a site report attachment',
    description:
      'Uploads one PDF, image, or archive file (zip/rar/7z/gz/tar/bz2) to S3 — max 50 MB. ' +
      'Returns { fileKey, fileName }. Use the returned values in the fileKey/fileName fields ' +
      'of the site report create/update body.',
  })
  async uploadSiteReportFile(
    @Request() req: { user: { id: string } },
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException(
        'No file uploaded. Provide a PDF, image, or archive in the "siteReportFile" field.',
      );
    }

    const SITE_REPORT_MAX_SIZE = 500 * 1024 * 1024; // 50 MB for all types (PDF, image, archive)
    const [validated] = validateFileUploads(
      [file],
      FILE_UPLOAD_FOLDER_NAMES.SITE_REPORT_FILES,
      SITE_REPORT_MAX_SIZE,
    );

    const fileKey = await this.filesService.uploadFile(
      validated.fileStream,
      validated.key,
      validated.mimetype,
    );

    return { fileKey, fileName: file.originalname };
  }
}
