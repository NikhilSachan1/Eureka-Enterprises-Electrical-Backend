import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { PaymentSheetItemInputDto } from './payment-sheet-item-input.dto';

export class CreatePaymentSheetDto {
  @ApiPropertyOptional({ example: 'June 2026 employee + vendor settlement' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiProperty({ type: [PaymentSheetItemInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PaymentSheetItemInputDto)
  items: PaymentSheetItemInputDto[];
}

export class AddPaymentSheetItemsDto {
  @ApiProperty({ type: [PaymentSheetItemInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PaymentSheetItemInputDto)
  items: PaymentSheetItemInputDto[];
}

export class UpdatePaymentSheetDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}
