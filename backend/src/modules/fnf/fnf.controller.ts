import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Request,
  Res,
  ParseUUIDPipe,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { FnfService } from './fnf.service';
import { InitiateFnfDto, UpdateFnfDto, UpdateClearanceDto, FnfQueryDto } from './dto';
import { FnfDocumentType } from './documents/fnf-document.constants';
import { RequestWithTimezone } from './fnf.types';
import { FnfUserInterceptor } from './interceptors/fnf-user.interceptor';

@ApiTags('FNF (Full & Final Settlement)')
@ApiBearerAuth('JWT-auth')
@Controller('fnf')
export class FnfController {
  constructor(private readonly fnfService: FnfService) {}

  @Post('initiate')
  @ApiOperation({
    summary: 'Initiate FNF settlement',
    description: 'Initiates a Full & Final (FNF) settlement process for an employee.',
  })
  async initiate(@Body() createDto: InitiateFnfDto, @Request() req) {
    return this.fnfService.initiate(createDto, req.user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all FNF settlements',
    description:
      'Retrieves a list of FNF settlement records with optional filtering and pagination.',
  })
  @UseInterceptors(FnfUserInterceptor)
  async findAll(@Query() query: FnfQueryDto) {
    return this.fnfService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get FNF settlement by ID',
    description: 'Retrieves a specific FNF settlement record by its ID.',
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.fnfService.findOne(id);
  }

  @Post(':id/calculate')
  @ApiOperation({
    summary: 'Calculate FNF settlement',
    description: 'Calculates the Full & Final settlement amount for a specific FNF record.',
  })
  async calculate(@Param('id', ParseUUIDPipe) id: string, @Request() req: RequestWithTimezone) {
    return this.fnfService.calculate(id, req.user.id, req.timezone);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update FNF settlement',
    description: 'Updates an existing FNF settlement record with the provided data.',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateFnfDto,
    @Request() req,
  ) {
    return this.fnfService.update(id, updateDto, req.user.id);
  }

  @Get(':id/clearance')
  @ApiOperation({
    summary: 'Get clearance status',
    description: 'Retrieves the clearance status for a specific FNF settlement.',
  })
  async getClearanceStatus(@Param('id', ParseUUIDPipe) id: string) {
    return this.fnfService.getClearanceStatus(id);
  }

  @Patch(':id/clearance')
  @ApiOperation({
    summary: 'Update clearance status',
    description: 'Updates the clearance status for a specific FNF settlement.',
  })
  async updateClearance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateClearanceDto,
    @Request() req,
  ) {
    return this.fnfService.updateClearance(id, updateDto, req.user.id);
  }

  @Post(':id/approve')
  @ApiOperation({
    summary: 'Approve FNF settlement',
    description: 'Approves a Full & Final settlement record.',
  })
  async approve(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.fnfService.approve(id, req.user.id);
  }

  @Post(':id/complete')
  @ApiOperation({
    summary: 'Complete FNF settlement',
    description: 'Marks a Full & Final settlement as completed.',
  })
  async complete(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.fnfService.complete(id, req.user.id);
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Cancel FNF settlement',
    description: 'Cancels a Full & Final settlement with optional remarks.',
  })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('remarks') remarks: string,
    @Request() req,
  ) {
    return this.fnfService.cancel(id, req.user.id, remarks);
  }

  @Post(':id/generate-documents')
  @ApiOperation({
    summary: 'Generate FNF documents',
    description: 'Generates all required documents for a Full & Final settlement.',
  })
  async generateDocuments(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.fnfService.generateDocuments(id, req.user.id);
  }

  @Get(':id/documents/:type')
  @ApiOperation({
    summary: 'Download FNF document',
    description: 'Downloads a specific FNF document (PDF) by type for a given settlement.',
  })
  async downloadDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('type') type: FnfDocumentType,
    @Res() res: Response,
  ) {
    const { buffer, fileName } = await this.fnfService.getDocumentBuffer(id, type);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  @Post(':id/send-documents')
  @ApiOperation({
    summary: 'Send FNF documents via email',
    description: 'Sends all FNF documents to the employee via email.',
  })
  async sendDocuments(@Param('id', ParseUUIDPipe) id: string) {
    return this.fnfService.sendDocumentsViaEmail(id);
  }
}
