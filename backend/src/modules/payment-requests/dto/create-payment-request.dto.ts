import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsNumber, Min, IsString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePaymentRequestDto {
  @ApiProperty({ description: 'Invoice this payment is requested against' })
  @IsUUID('4')
  invoiceId: string;

  @ApiProperty({ description: 'Requested amount', example: 20000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  requestedAmount: number;

  @ApiPropertyOptional({ description: 'Reason / details for the request' })
  @IsString()
  @IsOptional()
  reason?: string;
}
