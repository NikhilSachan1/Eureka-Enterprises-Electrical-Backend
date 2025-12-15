import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  IsDateString,
} from 'class-validator';
import { AnnouncementStatus } from '../constants/announcement.constants';
import { AnnouncementTargetDto } from './create-announcement.dto';

export class UpdateAnnouncementDto {
  @ApiPropertyOptional({
    description: 'Announcement title',
    example: 'Updated Announcement Title',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Announcement message',
    example: 'Updated announcement message content.',
  })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({
    description: 'Announcement status',
    enum: AnnouncementStatus,
  })
  @IsOptional()
  @IsEnum(AnnouncementStatus)
  status?: AnnouncementStatus;

  @ApiPropertyOptional({
    description: 'Start date/time for the announcement',
    example: '2025-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @ApiPropertyOptional({
    description: 'Expiry date/time for the announcement',
    example: '2025-12-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  expiryAt?: string;

  @ApiPropertyOptional({
    description: 'List of targets for this announcement (replaces existing targets)',
    type: [AnnouncementTargetDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnnouncementTargetDto)
  targets?: AnnouncementTargetDto[];
}
