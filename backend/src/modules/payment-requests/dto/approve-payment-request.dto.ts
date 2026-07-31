import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, Min, IsString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class ApprovePaymentRequestDto {
  @ApiPropertyOptional({
    description: 'Approved amount. Omit to approve the requested amount as-is; set to adjust.',
    example: 18000,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @IsOptional()
  approvedAmount?: number;

  @ApiPropertyOptional({ description: 'Remarks (carried to the book payment)' })
  @IsString()
  @IsOptional()
  remarks?: string;
}
