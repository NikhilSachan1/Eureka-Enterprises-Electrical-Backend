import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID, ArrayNotEmpty, ArrayMaxSize } from 'class-validator';

/** Selected asset master IDs to include in the generated Asset Report PDF. */
export class GenerateAssetReportDto {
  @ApiProperty({ type: [String], description: 'Asset master IDs to include in the report' })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(1000)
  @IsUUID('4', { each: true })
  assetMasterIds: string[];
}
