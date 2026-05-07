import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsDateString,
  IsString,
  IsOptional,
} from 'class-validator';

export class CreateGstPaymentDto {
  @ApiProperty({ description: 'Site ID' })
  @IsUUID()
  siteId: string;

  @ApiProperty({ description: 'Vendor ID' })
  @IsUUID()
  vendorId: string;

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
