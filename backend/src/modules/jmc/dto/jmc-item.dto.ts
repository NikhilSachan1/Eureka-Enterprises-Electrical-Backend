import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

/** A single JMC line item. Unit and quantity are free text (per requirement). */
export class JmcItemDto {
  @ApiProperty({ description: 'Item name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  itemName: string;

  @ApiProperty({ description: 'Unit (free text, e.g. Nos / Kg / Cum)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  unit: string;

  @ApiProperty({ description: 'Quantity (free text)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  quantity: string;
}
