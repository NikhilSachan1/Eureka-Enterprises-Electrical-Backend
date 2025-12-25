import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsBoolean, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';

export class GetSalaryStructureDto extends BaseGetDto {
  @ApiProperty({ description: 'Filter by user ID', required: false })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({ description: 'Filter by active status', required: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;

  @ApiProperty({ description: 'Get structure effective on this date', required: false })
  @IsOptional()
  @IsDateString()
  asOfDate?: string;

  @ApiProperty({ description: 'Include change history', required: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  includeHistory?: boolean;
}
