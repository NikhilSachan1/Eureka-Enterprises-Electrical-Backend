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
import { CompanyBankAccountService } from './company-bank-account.service';
import {
  CreateCompanyBankAccountDto,
  UpdateCompanyBankAccountDto,
  QueryCompanyBankAccountDto,
} from './dto';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { RequiredPermission } from 'src/modules/auth/decorators/required-permission.decorator';
import { COMPANY_BANK_ACCOUNT_PERMISSIONS } from './constants/company-bank-account.constants';

@ApiTags('Company Bank Accounts')
@ApiBearerAuth('JWT-auth')
@Controller('company-bank-accounts')
export class CompanyBankAccountController {
  constructor(private readonly service: CompanyBankAccountService) {}

  @Post()
  @RequiredPermission(COMPANY_BANK_ACCOUNT_PERMISSIONS.CREATE)
  @ApiOperation({ summary: 'Add a company bank account (source-of-funds master list)' })
  create(@Body() dto: CreateCompanyBankAccountDto, @GetUser('id') userId: string) {
    return this.service.create(dto, userId);
  }

  @Get()
  @RequiredPermission(COMPANY_BANK_ACCOUNT_PERMISSIONS.VIEW)
  @ApiOperation({ summary: 'List company bank accounts' })
  findAll(@Query() query: QueryCompanyBankAccountDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @RequiredPermission(COMPANY_BANK_ACCOUNT_PERMISSIONS.VIEW)
  @ApiOperation({ summary: 'Get a company bank account by id' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Patch(':id')
  @RequiredPermission(COMPANY_BANK_ACCOUNT_PERMISSIONS.UPDATE)
  @ApiOperation({ summary: 'Update a company bank account' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompanyBankAccountDto,
    @GetUser('id') userId: string,
  ) {
    return this.service.update(id, dto, userId);
  }

  @Patch(':id/set-default')
  @RequiredPermission(COMPANY_BANK_ACCOUNT_PERMISSIONS.UPDATE)
  @ApiOperation({ summary: 'Mark this account as the default for pickers' })
  setDefault(@Param('id', ParseUUIDPipe) id: string, @GetUser('id') userId: string) {
    return this.service.setDefault(id, userId);
  }

  @Delete(':id')
  @RequiredPermission(COMPANY_BANK_ACCOUNT_PERMISSIONS.DELETE)
  @ApiOperation({ summary: 'Delete a company bank account (blocked if used in any past payment)' })
  remove(@Param('id', ParseUUIDPipe) id: string, @GetUser('id') userId: string) {
    return this.service.remove(id, userId);
  }
}
