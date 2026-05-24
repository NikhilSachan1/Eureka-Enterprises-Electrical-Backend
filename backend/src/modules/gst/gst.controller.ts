import { Controller, Get, Post, Body, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GstService } from './gst.service';
import { GetGstRegisterDto, CreateGstPaymentDto, GetGstSummaryDto } from './dto';
import { VerifyEntryDto } from 'src/modules/common/financials/verify.dto';
import { RevertEntryDto } from 'src/modules/common/financials/revert.dto';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { RequiredPermission } from 'src/modules/auth/decorators/required-permission.decorator';

@ApiTags('GST')
@ApiBearerAuth('JWT-auth')
@Controller('gst')
export class GstController {
  constructor(private readonly gstService: GstService) {}

  @Get('register')
  @RequiredPermission('financials.gst.view')
  @ApiOperation({ summary: 'List GST register entries with filters' })
  findAllRegisterEntries(@Query() query: GetGstRegisterDto) {
    return this.gstService.findAllRegisterEntries(query);
  }

  @Get('register/:id')
  @RequiredPermission('financials.gst.view')
  @ApiOperation({ summary: 'Get a single GST register entry by ID' })
  findRegisterEntryById(@Param('id', ParseUUIDPipe) id: string) {
    return this.gstService.findRegisterEntryById(id);
  }

  @Post('register/:id/verify')
  @RequiredPermission('financials.gst.verify')
  @ApiOperation({ summary: 'Verify a GST register entry (PURCHASE side only)' })
  verifyEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('id') userId: string,
    @Body() dto: VerifyEntryDto,
  ) {
    return this.gstService.verifyEntry(id, userId, dto);
  }

  @Post('register/:id/revert')
  @RequiredPermission('financials.gst.revert')
  @ApiOperation({
    summary: 'Revert verification of a GST register entry (blocked if payment released)',
  })
  revertEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('id') userId: string,
    @Body() dto: RevertEntryDto,
  ) {
    return this.gstService.revertEntry(id, userId, dto.reason);
  }

  @Post('payments')
  @RequiredPermission('financials.gst.release-payment')
  @ApiOperation({ summary: 'Release monthly GST payment (atomic across all verified entries)' })
  releasePayment(@Body() dto: CreateGstPaymentDto, @GetUser('id') userId: string) {
    return this.gstService.releasePayment(dto, userId);
  }

  @Get('payments')
  @RequiredPermission('financials.gst.view')
  @ApiOperation({ summary: 'List GST payments' })
  findAllPayments(@Query('siteId') siteId?: string, @Query('vendorId') vendorId?: string) {
    return this.gstService.findAllPayments(siteId, vendorId);
  }

  @Get('summary')
  @RequiredPermission('financials.gst.view')
  @ApiOperation({ summary: 'Get GST summary per BRD §5.3' })
  getSummary(@Query() query: GetGstSummaryDto) {
    return this.gstService.getSummary(query);
  }
}
