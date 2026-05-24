import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsDateString, IsString, IsOptional, IsArray, ArrayMinSize } from 'class-validator';

export class CreateGstPaymentDto {
  @ApiProperty({
    description: 'GST register entry IDs to release (bulk selection)',
    type: [String],
    example: ['uuid1', 'uuid2'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  entryIds: string[];

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
