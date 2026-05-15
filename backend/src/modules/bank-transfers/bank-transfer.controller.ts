import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BankTransferService } from './bank-transfer.service';
import { CreateBankTransferDto, UpdateBankTransferDto, GetBankTransferDto } from './dto';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { RequiredPermission } from 'src/modules/auth/decorators/required-permission.decorator';

@ApiTags('Bank Transfers')
@ApiBearerAuth('JWT-auth')
@Controller('bank-transfers')
export class BankTransferController {
  constructor(private readonly bankTransferService: BankTransferService) {}

  @Post()
  @RequiredPermission('financials.bank-transfers.create')
  @ApiOperation({
    summary:
      'Create a bank transfer (SALE: links to invoice; PURCHASE: links to book payment, auto-generates payment advice)',
  })
  create(@Body() dto: CreateBankTransferDto, @GetUser('id') userId: string) {
    return this.bankTransferService.create(dto, userId);
  }

  @Get()
  @RequiredPermission('financials.bank-transfers.view')
  @ApiOperation({ summary: 'List bank transfers with filters and pagination' })
  findAll(@Query() query: GetBankTransferDto) {
    return this.bankTransferService.findAll(query);
  }

  @Get(':id')
  @RequiredPermission('financials.bank-transfers.view')
  @ApiOperation({ summary: 'Get a single bank transfer by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.bankTransferService.findById(id);
  }

  @Patch(':id')
  @RequiredPermission('financials.bank-transfers.update')
  @ApiOperation({
    summary: 'Update a bank transfer (amount only editable for SALE side without payment advice)',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBankTransferDto,
    @GetUser('id') userId: string,
  ) {
    return this.bankTransferService.update(id, dto, userId);
  }

  @Delete(':id')
  @RequiredPermission('financials.bank-transfers.delete')
  @ApiOperation({ summary: 'Delete a bank transfer (only if no payment advice exists)' })
  remove(@Param('id', ParseUUIDPipe) id: string, @GetUser('id') userId: string) {
    return this.bankTransferService.remove(id, userId);
  }
}
