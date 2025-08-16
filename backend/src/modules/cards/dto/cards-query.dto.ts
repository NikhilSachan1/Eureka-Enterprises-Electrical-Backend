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
    example: 'Debit',
    required: false,
  })
  @IsOptional()
  @IsString()
  cardType?: string;

  @ApiProperty({
    description: 'Expiry date',
    example: '2025-01-01',
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
