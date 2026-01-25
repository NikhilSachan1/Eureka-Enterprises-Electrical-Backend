import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsDateString,
  IsNumber,
  IsArray,
  ArrayMinSize,
  MinLength,
  MaxLength,
  Matches,
  IsEnum,
  Min,
} from 'class-validator';
import { SiteStatus, SITE_VALIDATION, SITE_ERRORS } from '../constants/site.constants';

export class CreateSiteDto {
  @ApiProperty({
    description: 'Site name',
    example: 'Power Plant Construction',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(SITE_VALIDATION.NAME_MIN_LENGTH)
  @MaxLength(SITE_VALIDATION.NAME_MAX_LENGTH)
  name: string;

  @ApiProperty({
    description: 'Company ID where work is executed',
    example: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  companyId: string;

  @ApiProperty({
    description: 'List of contractor IDs',
    example: ['uuid1', 'uuid2'],
  })
  @IsArray()
  @ArrayMinSize(1, { message: SITE_ERRORS.AT_LEAST_ONE_CONTRACTOR })
  @IsUUID('4', { each: true })
  contractorIds: string[];

  @ApiProperty({
    description: 'Site Manager Name',
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  managerName: string;

  @ApiPropertyOptional({
    description: 'Site Manager Contact (phone/email)',
    example: '9876543210',
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  managerContact?: string;

  @ApiProperty({
    description: 'Site start date',
    example: '2024-01-15',
  })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiPropertyOptional({
    description: 'Site end date (optional)',
    example: '2024-06-15',
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Base distance in KM for travel/fuel calculations',
    example: 150.5,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  baseDistanceKm?: number;

  @ApiPropertyOptional({
    description: 'Initial site status',
    enum: SiteStatus,
    default: SiteStatus.UPCOMING,
  })
  @IsEnum(SiteStatus)
  @IsOptional()
  status?: SiteStatus;

  // Address fields (all optional)
  @ApiPropertyOptional({ description: 'Block/Plot number' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  blockNumber?: string;

  @ApiPropertyOptional({ description: 'Building name' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  buildingName?: string;

  @ApiPropertyOptional({ description: 'Street name' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  streetName?: string;

  @ApiPropertyOptional({ description: 'Landmark' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  landmark?: string;

  @ApiPropertyOptional({ description: 'Area/Locality' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  area?: string;

  @ApiPropertyOptional({ description: 'City' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ description: 'State' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional({ description: 'Pincode (6 digits)' })
  @IsString()
  @IsOptional()
  @Matches(SITE_VALIDATION.PINCODE_REGEX, {
    message: 'Invalid pincode format. Must be 6 digits.',
  })
  pincode?: string;

  @ApiPropertyOptional({ description: 'Country', default: 'India' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional({
    description: 'Work types for this site',
    example: ['Testing', 'Erection', 'Inspection'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  workTypes?: string[];

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}
