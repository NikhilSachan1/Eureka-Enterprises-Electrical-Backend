import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

/** A single PO line item (material being purchased). amount = quantity × rate. */
export class PoItemDto {
  @ApiProperty({ description: 'Item name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  itemName: string;

  @ApiPropertyOptional({ description: 'Rich multi-line description / scope' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'HSN code' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  hsnCode?: string;

  @ApiPropertyOptional({ description: 'Make / brand' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  make?: string;

  @ApiProperty({ description: 'Quantity', example: 10 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  quantity: number;

  @ApiPropertyOptional({
    description:
      'Unit of measure for quantity. Must be one of the values in the `po_units` config ' +
      '(GET /configurations/details?key=po_units). Optional — omit to leave it unset.',
    example: 'Nos',
  })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  unit?: string;

  @ApiProperty({ description: 'Rate per unit', example: 350 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  rate: number;

  @ApiProperty({ description: 'Line amount (= quantity × rate)', example: 3500 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;
}
