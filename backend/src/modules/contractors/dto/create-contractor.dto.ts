import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { CONTRACTOR_ERRORS, CONTRACTOR_VALIDATION } from '../constants/contractor.constants';

export class CreateContractorDto {
  @ApiProperty({
    description: 'Contractor name',
    example: 'ABC Contractors Pvt Ltd',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(CONTRACTOR_VALIDATION.NAME_MIN_LENGTH)
  @MaxLength(CONTRACTOR_VALIDATION.NAME_MAX_LENGTH)
  name: string;

  @ApiProperty({
    description: 'Email address',
    example: 'contact@abccontractors.com',
  })
  @IsEmail({}, { message: CONTRACTOR_ERRORS.INVALID_EMAIL })
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Contact number',
    example: '9876543210',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(CONTRACTOR_VALIDATION.CONTACT_REGEX, {
    message: CONTRACTOR_ERRORS.INVALID_CONTACT_NUMBER,
  })
  contactNumber: string;

  @ApiPropertyOptional({
    description: 'GST Number',
    example: '22AAAAA0000A1Z5',
  })
  @IsString()
  @IsOptional()
  @Matches(CONTRACTOR_VALIDATION.GST_REGEX, {
    message: CONTRACTOR_ERRORS.INVALID_GST_FORMAT,
  })
  gstNumber?: string;

  // Address fields
  @ApiPropertyOptional({
    description: 'Block/Plot number',
    example: 'A-101',
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  blockNumber?: string;

  @ApiPropertyOptional({
    description: 'Building name',
    example: 'Business Tower',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  buildingName?: string;

  @ApiPropertyOptional({
    description: 'Street name',
    example: 'Industrial Area Road',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  streetName?: string;

  @ApiPropertyOptional({
    description: 'Landmark',
    example: 'Near Railway Station',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  landmark?: string;

  @ApiPropertyOptional({
    description: 'Area/Locality',
    example: 'Industrial Estate',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  area?: string;

  @ApiProperty({
    description: 'City',
    example: 'Mumbai',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city: string;

  @ApiProperty({
    description: 'State',
    example: 'Maharashtra',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  state: string;

  @ApiProperty({
    description: 'Pincode (6 digits)',
    example: '400001',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(CONTRACTOR_VALIDATION.PINCODE_REGEX, {
    message: CONTRACTOR_ERRORS.INVALID_PINCODE,
  })
  pincode: string;

  @ApiPropertyOptional({
    description: 'Country',
    example: 'India',
    default: 'India',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  country?: string;

  // Bank details (optional)
  @ApiPropertyOptional({
    description: 'Bank name',
    example: 'State Bank of India',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  bankName?: string;

  @ApiPropertyOptional({
    description: 'Bank account number',
    example: '1234567890123456',
  })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  accountNumber?: string;

  @ApiPropertyOptional({
    description: 'IFSC Code',
    example: 'SBIN0001234',
  })
  @IsString()
  @IsOptional()
  @Matches(CONTRACTOR_VALIDATION.IFSC_REGEX, {
    message: CONTRACTOR_ERRORS.INVALID_IFSC,
  })
  ifscCode?: string;

  @ApiPropertyOptional({
    description: 'Account holder name',
    example: 'ABC Contractors Pvt Ltd',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  accountHolderName?: string;

  @ApiPropertyOptional({
    description: 'Remarks/Notes',
    example: 'Preferred contractor for electrical work',
  })
  @IsString()
  @IsOptional()
  remarks?: string;

  @ApiPropertyOptional({
    description: 'Is contractor active',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;
}
