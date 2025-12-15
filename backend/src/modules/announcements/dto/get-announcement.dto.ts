import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsArray, IsUUID, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import {
  AnnouncementStatus,
  AnnouncementSortableFields,
} from '../constants/announcement.constants';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';

export class GetAllAnnouncementsDto extends BaseGetDto {
  @ApiPropertyOptional({
    description: 'Filter by announcement status',
    enum: AnnouncementStatus,
  })
  @IsOptional()
  @IsEnum(AnnouncementStatus)
  status?: AnnouncementStatus;

  @ApiPropertyOptional({
    description: 'Search by title',
    example: 'Important',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Filter to show only unacknowledged announcements (for user view)',
    example: true,
  })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsOptional()
  @IsBoolean()
  unacknowledgedOnly?: boolean;

  @ApiPropertyOptional({
    description: 'Column to sort by',
    enum: AnnouncementSortableFields,
    example: AnnouncementSortableFields.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(AnnouncementSortableFields)
  sortField?: string = AnnouncementSortableFields.CREATED_AT;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsArray()
  roleIds?: string[];
}
