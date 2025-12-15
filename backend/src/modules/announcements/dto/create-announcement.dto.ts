import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  IsUUID,
  IsDateString,
} from 'class-validator';
import { AnnouncementStatus, AnnouncementTargetType } from '../constants/announcement.constants';

export class AnnouncementTargetDto {
  @ApiProperty({
    description: 'Target type',
    enum: AnnouncementTargetType,
    example: AnnouncementTargetType.USER,
  })
  @IsEnum(AnnouncementTargetType)
  @IsNotEmpty()
  targetType: AnnouncementTargetType;

  @ApiProperty({
    description: 'Target ID (User ID, Role ID, or Department ID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  targetId: string;
}

export class CreateAnnouncementDto {
  @ApiProperty({
    description: 'Announcement title',
    example: 'Important Update',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Announcement message',
    example: 'This is an important announcement for all employees.',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({
    description: 'Announcement status',
    enum: AnnouncementStatus,
    default: AnnouncementStatus.DRAFT,
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
    description: 'List of targets for this announcement',
    type: [AnnouncementTargetDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnnouncementTargetDto)
  targets?: AnnouncementTargetDto[];
}
