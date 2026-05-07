import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsDateString,
  IsString,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { PartyType } from 'src/modules/common/financials/financial.constants';

export class CreateTdsPaymentDto {
  @ApiProperty({ description: 'Site ID' })
  @IsUUID()
  siteId: string;

  @ApiProperty({ enum: PartyType, description: 'Party type (SALE or PURCHASE)' })
  @IsEnum(PartyType)
  partyType: PartyType;

  @ApiPropertyOptional({ description: 'Contractor ID (required for SALE side)' })
  @IsUUID()
  @IsOptional()
  contractorId?: string;

  @ApiPropertyOptional({ description: 'Vendor ID (required for PURCHASE side)' })
  @IsUUID()
  @IsOptional()
  vendorId?: string;

  @ApiProperty({ description: 'Payment month (YYYY-MM)' })
  @IsString()
  paymentMonth: string;

  @ApiProperty({ description: 'UTR number' })
  @IsString()
  utrNumber: string;

  @ApiProperty({ description: 'Payment date' })
  @IsDateString()
  paymentDate: string;

  @ApiPropertyOptional({ description: 'Proof file S3 key' })
  @IsString()
  @IsOptional()
  fileKey?: string;

  @ApiPropertyOptional({ description: 'Proof file name' })
  @IsString()
  @IsOptional()
  fileName?: string;

  @ApiPropertyOptional({ description: 'Remarks' })
  @IsString()
  @IsOptional()
  remarks?: string;
}
