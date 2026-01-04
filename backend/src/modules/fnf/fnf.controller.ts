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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { FnfService } from './fnf.service';
import { InitiateFnfDto, UpdateFnfDto, UpdateClearanceDto, FnfQueryDto } from './dto';
import { FnfDocumentType } from './documents/fnf-document.constants';
import { RequestWithTimezone } from './fnf.types';

@ApiTags('FNF (Full & Final Settlement)')
@ApiBearerAuth('JWT-auth')
@Controller('fnf')
export class FnfController {
  constructor(private readonly fnfService: FnfService) {}

  @Post('initiate')
  async initiate(@Body() createDto: InitiateFnfDto, @Request() req) {
    return this.fnfService.initiate(createDto, req.user.id);
  }

  @Get()
  async findAll(@Query() query: FnfQueryDto) {
    return this.fnfService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.fnfService.findOne(id);
  }

  @Post(':id/calculate')
  async calculate(@Param('id', ParseUUIDPipe) id: string, @Request() req: RequestWithTimezone) {
    return this.fnfService.calculate(id, req.user.id, req.timezone);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateFnfDto,
    @Request() req,
  ) {
    return this.fnfService.update(id, updateDto, req.user.id);
  }

  @Get(':id/clearance')
  async getClearanceStatus(@Param('id', ParseUUIDPipe) id: string) {
    return this.fnfService.getClearanceStatus(id);
  }

  @Patch(':id/clearance')
  async updateClearance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateClearanceDto,
    @Request() req,
  ) {
    return this.fnfService.updateClearance(id, updateDto, req.user.id);
  }

  @Post(':id/approve')
  async approve(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.fnfService.approve(id, req.user.id);
  }

  @Post(':id/complete')
  async complete(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.fnfService.complete(id, req.user.id);
  }

  @Post(':id/cancel')
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('remarks') remarks: string,
    @Request() req,
  ) {
    return this.fnfService.cancel(id, req.user.id, remarks);
  }

  @Post(':id/generate-documents')
  async generateDocuments(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.fnfService.generateDocuments(id, req.user.id);
  }

  @Get(':id/documents/:type')
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
  async sendDocuments(@Param('id', ParseUUIDPipe) id: string) {
    return this.fnfService.sendDocumentsViaEmail(id);
  }
}
