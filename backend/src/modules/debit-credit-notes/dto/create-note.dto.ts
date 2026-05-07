import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  IsEnum,
} from 'class-validator';
import { NoteSide } from 'src/modules/common/financials/financial.constants';

export class CreateNoteDto {
  @ApiProperty({ enum: NoteSide, description: 'SALE for debit note, PURCHASE for credit note' })
  @IsEnum(NoteSide)
  noteSide: NoteSide;

  @ApiProperty({ description: 'Site ID' })
  @IsUUID()
  siteId: string;

  @ApiPropertyOptional({ description: 'Contractor ID (required for SALE side)' })
  @IsUUID()
  @IsOptional()
  contractorId?: string;

  @ApiPropertyOptional({ description: 'Vendor ID (required for PURCHASE side)' })
  @IsUUID()
  @IsOptional()
  vendorId?: string;

  @ApiProperty({ description: 'Note amount' })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ description: 'Note date' })
  @IsDateString()
  noteDate: string;

  @ApiProperty({ description: 'File S3 key' })
  @IsString()
  fileKey: string;

  @ApiProperty({ description: 'File name' })
  @IsString()
  fileName: string;

  @ApiPropertyOptional({ description: 'Remarks' })
  @IsString()
  @IsOptional()
  remarks?: string;
}
