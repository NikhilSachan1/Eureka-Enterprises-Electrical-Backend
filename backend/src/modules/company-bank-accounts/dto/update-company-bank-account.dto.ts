import { ApiPropertyOptional } from '@nestjs/swagger';
import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateCompanyBankAccountDto } from './create-company-bank-account.dto';

export class UpdateCompanyBankAccountDto extends PartialType(CreateCompanyBankAccountDto) {
  @ApiPropertyOptional({ description: 'Deactivate without deleting' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
