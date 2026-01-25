import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { SiteStatus } from '../constants/site.constants';

export class UpdateSiteStatusDto {
  @ApiProperty({
    description: 'New site status',
    enum: SiteStatus,
  })
  @IsEnum(SiteStatus)
  @IsNotEmpty()
  status: SiteStatus;

  @ApiPropertyOptional({
    description: 'Reason for status change',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}
