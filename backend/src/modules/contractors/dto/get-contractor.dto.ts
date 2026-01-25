import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';

export class GetContractorDto extends BaseGetDto {
  @ApiPropertyOptional({
    description: 'Search by contractor name',
    example: 'ABC',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by city',
    example: 'Mumbai',
  })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({
    description: 'Filter by state',
    example: 'Maharashtra',
  })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiPropertyOptional({
    description: 'Filter by active status',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Exclude self contractor from results',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  excludeSelfContractor?: boolean;

  @ApiPropertyOptional({
    description: 'Only return self contractor',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  onlySelfContractor?: boolean;
}
