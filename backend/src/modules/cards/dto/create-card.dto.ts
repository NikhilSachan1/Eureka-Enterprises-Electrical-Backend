import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCardDto {
  @ApiProperty({
    description: 'The card number',
    example: 'HP1234AB5678',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  cardNumber: string;

  @ApiProperty({
    description: 'The card type',
    example: 'PETRO CARD',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  cardType: string;

  @ApiPropertyOptional({
    description: 'The card provider/company name (e.g., HP, BPCL, Indian Oil)',
    example: 'HP',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cardName?: string;

  @ApiPropertyOptional({
    description: 'The card holder name',
    example: 'John Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  holderName?: string;

  @ApiPropertyOptional({
    description: 'The card expiry date',
    example: '01/2025',
    required: false,
  })
  @IsOptional()
  @IsString()
  expiryDate?: string;
}
