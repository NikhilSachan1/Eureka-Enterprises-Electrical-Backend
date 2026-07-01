import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCompanyBankAccountDto {
  @ApiProperty({ example: 'HDFC Current A/c — Operations' })
  @IsString()
  @MaxLength(255)
  accountName: string;

  @ApiProperty({ example: 'Eureka Enterprises Pvt Ltd' })
  @IsString()
  @MaxLength(255)
  accountHolderName: string;

  @ApiProperty({ example: 'HDFC Bank' })
  @IsString()
  @MaxLength(255)
  bankName: string;

  @ApiProperty({ example: '50100513481911' })
  @IsString()
  @MaxLength(50)
  accountNumber: string;

  @ApiProperty({ example: 'HDFC0000453' })
  @IsString()
  @MaxLength(20)
  ifscCode: string;

  @ApiPropertyOptional({ example: 'MG Road Branch' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  branchName?: string;

  @ApiPropertyOptional({ description: 'Make this the default account for pickers' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}
