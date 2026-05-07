import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TdsService } from './tds.service';
import {
  GetTdsRegisterDto,
  CreateTdsPaymentDto,
} from './dto';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { RequiredPermission } from 'src/modules/auth/decorators/required-permission.decorator';
import { PartyType } from 'src/modules/common/financials/financial.constants';

@ApiTags('TDS')
@ApiBearerAuth()
@Controller('tds')
export class TdsController {
  constructor(private readonly tdsService: TdsService) {}

  @Get('register')
  @RequiredPermission('financials.tds.view')
  @ApiOperation({ summary: 'List TDS register entries with filters' })
  findAllRegisterEntries(@Query() query: GetTdsRegisterDto) {
    return this.tdsService.findAllRegisterEntries(query);
  }

  @Get('register/:id')
  @RequiredPermission('financials.tds.view')
  @ApiOperation({ summary: 'Get a single TDS register entry by ID' })
  findRegisterEntryById(@Param('id', ParseUUIDPipe) id: string) {
    return this.tdsService.findRegisterEntryById(id);
  }

  @Post('register/:id/verify')
  @RequiredPermission('financials.tds.verify')
  @ApiOperation({ summary: 'Verify a TDS register entry' })
  verifyEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('id') userId: string,
  ) {
    return this.tdsService.verifyEntry(id, userId);
  }

  @Post('register/:id/revert')
  @RequiredPermission('financials.tds.revert')
  @ApiOperation({ summary: 'Revert verification of a TDS register entry (blocked if payment released)' })
  revertEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('id') userId: string,
  ) {
    return this.tdsService.revertEntry(id, userId);
  }

  @Post('payments')
  @RequiredPermission('financials.tds.release-payment')
  @ApiOperation({ summary: 'Release monthly TDS payment (atomic across all verified entries)' })
  releasePayment(
    @Body() dto: CreateTdsPaymentDto,
    @GetUser('id') userId: string,
  ) {
    return this.tdsService.releasePayment(dto, userId);
  }

  @Get('payments')
  @RequiredPermission('financials.tds.view')
  @ApiOperation({ summary: 'List TDS payments' })
  findAllPayments(
    @Query('siteId') siteId?: string,
    @Query('partyType') partyType?: PartyType,
  ) {
    return this.tdsService.findAllPayments(siteId, partyType);
  }
}
