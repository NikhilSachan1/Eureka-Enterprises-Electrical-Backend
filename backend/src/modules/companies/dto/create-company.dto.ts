import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEmail,
  IsUUID,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { COMPANY_VALIDATION, COMPANY_ERRORS } from '../constants/company.constants';

export class CreateCompanyDto {
  // ==================== Basic Information ====================
  @ApiProperty({
    description: 'Company name (must be unique)',
    example: 'ABC Corporation Pvt Ltd',
    minLength: COMPANY_VALIDATION.NAME_MIN_LENGTH,
    maxLength: COMPANY_VALIDATION.NAME_MAX_LENGTH,
  })
  @IsString()
  @MinLength(COMPANY_VALIDATION.NAME_MIN_LENGTH)
  @MaxLength(COMPANY_VALIDATION.NAME_MAX_LENGTH)
  name: string;

  @ApiProperty({
    description: 'Company website URL',
    example: 'https://www.abccorp.com',
    required: false,
  })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiProperty({
    description: 'Company contact number',
    example: '9876543210',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(COMPANY_VALIDATION.CONTACT_REGEX, {
    message: COMPANY_ERRORS.INVALID_CONTACT_NUMBER,
  })
  contactNumber?: string;

  @ApiProperty({
    description: 'Company email address',
    example: 'contact@abccorp.com',
    required: false,
  })
  @IsOptional()
  @IsEmail({}, { message: COMPANY_ERRORS.INVALID_EMAIL })
  email?: string;

  @ApiProperty({
    description: 'GST Number (15 characters)',
    example: '22AAAAA0000A1Z5',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(COMPANY_VALIDATION.GST_REGEX, {
    message: COMPANY_ERRORS.INVALID_GST_FORMAT,
  })
  gstNumber?: string;

  // ==================== Address Information ====================
  @ApiProperty({
    description: 'Block/Plot number',
    example: 'B-204',
    required: false,
  })
  @IsOptional()
  @IsString()
  blockNumber?: string;

  @ApiProperty({
    description: 'Building/Complex name',
    example: 'Tech Park Tower',
    required: false,
  })
  @IsOptional()
  @IsString()
  buildingName?: string;

  @ApiProperty({
    description: 'Street name',
    example: 'MG Road',
    required: false,
  })
  @IsOptional()
  @IsString()
  streetName?: string;

  @ApiProperty({
    description: 'Landmark',
    example: 'Near City Mall',
    required: false,
  })
  @IsOptional()
  @IsString()
  landmark?: string;

  @ApiProperty({
    description: 'Area/Locality',
    example: 'Bandra West',
    required: false,
  })
  @IsOptional()
  @IsString()
  area?: string;

  @ApiProperty({
    description: 'City',
    example: 'Mumbai',
    required: false,
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({
    description: 'State',
    example: 'Maharashtra',
    required: false,
  })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({
    description: 'Pincode (6 digits)',
    example: '400050',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(COMPANY_VALIDATION.PINCODE_REGEX, {
    message: COMPANY_ERRORS.INVALID_PINCODE,
  })
  pincode?: string;

  @ApiProperty({
    description: 'Country',
    example: 'India',
    required: false,
  })
  @IsOptional()
  @IsString()
  country?: string;

  // ==================== Parent Company ====================
  @ApiProperty({
    description: 'Parent company ID (for subsidiary companies)',
    example: 'uuid-of-parent-company',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  parentCompanyId?: string;

  // ==================== Additional ====================
  @ApiProperty({
    description: 'Additional remarks or notes',
    example: 'Key client for power sector projects',
    required: false,
  })
  @IsOptional()
  @IsString()
  remarks?: string;

  // ==================== File Upload (handled by decorator) ====================
  @ApiProperty({
    description: 'Company logo file',
    type: 'string',
    format: 'binary',
    required: false,
  })
  @IsOptional()
  logo?: any;
}
