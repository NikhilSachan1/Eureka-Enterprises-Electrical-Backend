import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumberString, IsOptional, IsString, Length } from 'class-validator';

export class CreateCardDto {
  @ApiProperty({
    description: 'The card number',
    example: '1234567890123456',
    minLength: 16,
    maxLength: 16,
    required: true,
  })
  @IsNotEmpty()
  @IsNumberString()
  @Length(16, 16)
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
