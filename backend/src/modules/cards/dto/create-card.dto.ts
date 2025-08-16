import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumberString, IsString, Length } from 'class-validator';

export class CreateCardDto {
  @ApiProperty({
    description: 'The card number',
    example: '1234567890',
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

  @ApiProperty({
    description: 'The card holder name',
    example: 'John Doe',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  holderName: string;

  @ApiProperty({
    description: 'The card expiry date',
    example: '01/2025',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  expiryDate: string;
}
