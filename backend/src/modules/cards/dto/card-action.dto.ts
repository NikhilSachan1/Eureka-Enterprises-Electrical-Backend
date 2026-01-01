import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { CardActionType } from '../constants/card.constants';

export class CardActionDto {
  @ApiProperty({
    description: 'The card ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: true,
  })
  @IsNotEmpty()
  @IsUUID()
  cardId: string;

  @ApiProperty({
    description: 'Action type',
    enum: CardActionType,
    example: CardActionType.ASSIGN,
    required: true,
  })
  @IsNotEmpty()
  @IsEnum(CardActionType)
  action: CardActionType;

  @ApiPropertyOptional({
    description: 'The vehicle ID to assign the card to (required for ASSIGN action)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  vehicleMasterId?: string;
}
