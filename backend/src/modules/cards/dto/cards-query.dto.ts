import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';

export class CardsQueryDto extends BaseGetDto {
  @ApiProperty({
    description: 'Card number',
    example: '1234567890',
    required: false,
  })
  @IsOptional()
  @IsString()
  cardNumber?: string;

  @ApiProperty({
    description: 'Card type',
    example: 'PETRO CARD',
    required: false,
  })
  @IsOptional()
  @IsString()
  cardType?: string;

  @ApiProperty({
    description: 'Card provider/company name (e.g., HP, BPCL)',
    example: 'HP',
    required: false,
  })
  @IsOptional()
  @IsString()
  cardName?: string;

  @ApiProperty({
    description: 'Expiry date',
    example: '01/2025',
    required: false,
  })
  @IsOptional()
  @IsString()
  expiryDate?: string;

  @ApiProperty({
    description: 'Holder name',
    example: 'John Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  holderName?: string;

  @ApiProperty({
    description: 'Search',
    example: '1234567890',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;
}
