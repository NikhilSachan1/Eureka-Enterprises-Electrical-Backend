import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  IsDateString,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { USERS_ERRORS, VALIDATION_PATTERNS } from '../constants/user.constants';
import { Type } from 'class-transformer';

export class CreateEmployeeDto {
  // ==================== Basic Information (Required) ====================

  @ApiProperty({ description: 'First name', required: true, example: 'John' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  firstName: string;

  @ApiProperty({ description: 'Last name', required: true, example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  lastName: string;

  @ApiProperty({ description: 'Email address', required: true, example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email: string;

  @ApiProperty({ description: 'Contact number', required: true, example: '+919876543210' })
  @IsString()
  @IsNotEmpty()
  @Matches(VALIDATION_PATTERNS.PHONE, { message: USERS_ERRORS.INVALID_PHONE })
  contactNumber: string;

  @ApiProperty({ description: 'Role', required: true, example: 'EMPLOYEE' })
  @IsString()
  @IsNotEmpty()
  role: string;

  // ==================== Personal Information ====================

  @ApiProperty({ description: "Father's name", required: false, example: 'Robert Doe' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  fatherName?: string;

  @ApiProperty({ description: 'Emergency contact', required: false, example: '+919876543211' })
  @IsString()
  @IsOptional()
  @Matches(VALIDATION_PATTERNS.PHONE, { message: USERS_ERRORS.INVALID_PHONE })
  emergencyContactNumber?: string;

  @ApiProperty({ description: 'Gender', required: false, example: 'MALE' })
  @IsString()
  @IsOptional()
  gender?: string;

  @ApiProperty({
    description: 'Date of birth (YYYY-MM-DD)',
    required: false,
    example: '1990-05-15',
  })
  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @ApiProperty({ description: 'Blood group', required: false, example: 'O+' })
  @IsString()
  @IsOptional()
  bloodGroup?: string;

  // ==================== Address Information ====================

  @ApiProperty({ description: 'House number', required: false, example: '42-A' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  houseNumber?: string;

  @ApiProperty({ description: 'Street name', required: false, example: 'Baker Street' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  streetName?: string;

  @ApiProperty({ description: 'Landmark', required: false, example: 'Near Central Park' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  landmark?: string;

  @ApiProperty({ description: 'City', required: false, example: 'Mumbai' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  city?: string;

  @ApiProperty({ description: 'State', required: false, example: 'Maharashtra' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  state?: string;

  @ApiProperty({ description: 'Pincode (6 digits)', required: false, example: '400001' })
  @IsString()
  @IsOptional()
  @Matches(VALIDATION_PATTERNS.PINCODE, { message: USERS_ERRORS.INVALID_PINCODE })
  pincode?: string;

  // ==================== Employment Details ====================

  @ApiProperty({
    description: 'Date of joining (YYYY-MM-DD)',
    required: false,
    example: '2024-01-15',
  })
  @IsDateString()
  @IsOptional()
  dateOfJoining?: string;

  @ApiProperty({ description: 'Previous experience', required: false, example: '3 years' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  previousExperience?: string;

  @ApiProperty({ description: 'Employee type', required: false, example: 'PERMANENT' })
  @IsString()
  @IsOptional()
  employeeType?: string;

  @ApiProperty({ description: 'Designation', required: false, example: 'DEVELOPER' })
  @IsString()
  @IsOptional()
  designation?: string;

  @ApiProperty({ description: 'Profile picture S3 key', required: false })
  @IsString()
  @IsOptional()
  profilePicture?: string;

  // ==================== Education Details ====================

  @ApiProperty({ description: 'Degree', required: false, example: 'B.TECH' })
  @IsString()
  @IsOptional()
  degree?: string;

  @ApiProperty({ description: 'Branch', required: false, example: 'COMPUTER_SCIENCE' })
  @IsString()
  @IsOptional()
  branch?: string;

  @ApiProperty({ description: 'Passout year', required: false, example: 2020 })
  @IsInt()
  @IsOptional()
  @Min(1950, { message: USERS_ERRORS.INVALID_PASSOUT_YEAR })
  @Max(new Date().getFullYear() + 5, { message: USERS_ERRORS.INVALID_PASSOUT_YEAR })
  @Type(() => Number)
  passoutYear?: number;

  // ==================== Banking Details ====================

  @ApiProperty({ description: 'Bank holder name', required: false, example: 'John Doe' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  bankHolderName?: string;

  @ApiProperty({ description: 'Account number', required: false, example: '123456789012' })
  @IsString()
  @IsOptional()
  @Matches(VALIDATION_PATTERNS.ACCOUNT_NUMBER, { message: USERS_ERRORS.INVALID_ACCOUNT_NUMBER })
  accountNumber?: string;

  @ApiProperty({ description: 'Bank name', required: false, example: 'State Bank of India' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  bankName?: string;

  @ApiProperty({ description: 'IFSC code', required: false, example: 'SBIN0001234' })
  @IsString()
  @IsOptional()
  @Matches(VALIDATION_PATTERNS.IFSC, { message: USERS_ERRORS.INVALID_IFSC })
  ifscCode?: string;

  // ==================== Government IDs ====================
  // Note: Document files are uploaded separately and stored in user_documents table

  @ApiProperty({ description: 'ESIC number (17 digits)', required: false })
  @IsString()
  @IsOptional()
  @Matches(VALIDATION_PATTERNS.ESIC, { message: 'Invalid ESIC number. Must be 17 digits.' })
  esicNumber?: string;

  @ApiProperty({ description: 'Aadhar number (12 digits)', required: false })
  @IsString()
  @IsOptional()
  @Matches(VALIDATION_PATTERNS.AADHAR, { message: USERS_ERRORS.INVALID_AADHAR })
  aadharNumber?: string;

  @ApiProperty({ description: 'PAN number', required: false, example: 'ABCDE1234F' })
  @IsString()
  @IsOptional()
  @Matches(VALIDATION_PATTERNS.PAN, { message: USERS_ERRORS.INVALID_PAN })
  panNumber?: string;

  @ApiProperty({ description: 'DL number', required: false, example: 'MH01-2020-1234567' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  dlNumber?: string;

  @ApiProperty({ description: 'UAN number (12 digits)', required: false, example: '123456789012' })
  @IsString()
  @IsOptional()
  @Matches(VALIDATION_PATTERNS.UAN, { message: USERS_ERRORS.INVALID_UAN })
  uanNumber?: string;

  @ApiProperty({ description: 'Passport number', required: false, example: 'A1234567' })
  @IsString()
  @IsOptional()
  @Matches(VALIDATION_PATTERNS.PASSPORT, { message: USERS_ERRORS.INVALID_PASSPORT })
  passportNumber?: string;
}
