import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsEnum,
  IsString,
  IsInt,
  IsDateString,
  Min,
  Max,
  MaxLength,
  Matches,
} from 'class-validator';
import {
  USER_DTO_ERRORS,
  UserStatus,
  VALIDATION_PATTERNS,
  USERS_ERRORS,
} from '../constants/user.constants';
import { Type } from 'class-transformer';

export class UpdateUserDto {
  // ==================== Basic Information ====================
  @ApiProperty({ description: 'First name', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  firstName?: string;

  @ApiProperty({ description: 'Last name', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  lastName?: string;

  @ApiProperty({ description: 'Contact number', required: false })
  @IsOptional()
  @IsString()
  @Matches(VALIDATION_PATTERNS.PHONE, { message: USERS_ERRORS.INVALID_PHONE })
  contactNumber?: string;

  @ApiProperty({ description: 'User status', required: false, enum: UserStatus })
  @IsOptional()
  @IsString()
  @IsEnum(UserStatus, {
    message: `${USER_DTO_ERRORS.INVALID_STATUS} ${Object.values(UserStatus).join(', ')}`,
  })
  status?: string;

  @ApiProperty({ description: 'Profile picture S3 key', required: false })
  @IsOptional()
  @IsString()
  profilePicture?: string;

  @ApiProperty({ description: 'Employee ID', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  employeeId?: string;

  // ==================== Personal Information ====================
  @ApiProperty({ description: "Father's name", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fatherName?: string;

  @ApiProperty({ description: 'Emergency contact number', required: false })
  @IsOptional()
  @IsString()
  @Matches(VALIDATION_PATTERNS.PHONE, { message: USERS_ERRORS.INVALID_PHONE })
  emergencyContactNumber?: string;

  @ApiProperty({ description: 'Gender (from config_settings)', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  gender?: string;

  @ApiProperty({ description: 'Date of birth (YYYY-MM-DD)', required: false })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiProperty({ description: 'Blood group (from config_settings)', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  bloodGroup?: string;

  // ==================== Address Information ====================
  @ApiProperty({ description: 'House number', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  houseNumber?: string;

  @ApiProperty({ description: 'Street name', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  streetName?: string;

  @ApiProperty({ description: 'Landmark', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  landmark?: string;

  @ApiProperty({ description: 'City', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiProperty({ description: 'State', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiProperty({ description: 'Pincode (6 digits)', required: false })
  @IsOptional()
  @IsString()
  @Matches(VALIDATION_PATTERNS.PINCODE, { message: USERS_ERRORS.INVALID_PINCODE })
  pincode?: string;

  // ==================== Employment Details ====================
  @ApiProperty({ description: 'Date of joining (YYYY-MM-DD)', required: false })
  @IsOptional()
  @IsDateString()
  dateOfJoining?: string;

  @ApiProperty({ description: 'Previous experience', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  previousExperience?: string;

  @ApiProperty({ description: 'Employee type (from config_settings)', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  employeeType?: string;

  @ApiProperty({ description: 'Designation (from config_settings)', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  designation?: string;

  // ==================== Education Details ====================
  @ApiProperty({ description: 'Degree (from config_settings)', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  degree?: string;

  @ApiProperty({ description: 'Branch (from config_settings)', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  branch?: string;

  @ApiProperty({ description: 'Passout year', required: false })
  @IsOptional()
  @IsInt()
  @Min(1950, { message: USERS_ERRORS.INVALID_PASSOUT_YEAR })
  @Max(new Date().getFullYear() + 5, { message: USERS_ERRORS.INVALID_PASSOUT_YEAR })
  @Type(() => Number)
  passoutYear?: number;

  // ==================== Banking Details ====================
  @ApiProperty({ description: 'Bank account holder name', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  bankHolderName?: string;

  @ApiProperty({ description: 'Bank account number', required: false })
  @IsOptional()
  @IsString()
  @Matches(VALIDATION_PATTERNS.ACCOUNT_NUMBER, { message: USERS_ERRORS.INVALID_ACCOUNT_NUMBER })
  accountNumber?: string;

  @ApiProperty({ description: 'Bank name', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  bankName?: string;

  @ApiProperty({ description: 'IFSC code', required: false })
  @IsOptional()
  @IsString()
  @Matches(VALIDATION_PATTERNS.IFSC, { message: USERS_ERRORS.INVALID_IFSC })
  ifscCode?: string;

  // ==================== Government IDs ====================
  // Note: Document files are uploaded separately and stored in user_documents table
  @ApiProperty({ description: 'ESIC number', required: false })
  @IsOptional()
  @IsString()
  @Matches(VALIDATION_PATTERNS.ESIC, { message: 'Invalid ESIC number. Must be 17 digits.' })
  esicNumber?: string;

  @ApiProperty({ description: 'Aadhar number', required: false })
  @IsOptional()
  @IsString()
  @Matches(VALIDATION_PATTERNS.AADHAR, { message: USERS_ERRORS.INVALID_AADHAR })
  aadharNumber?: string;

  @ApiProperty({ description: 'PAN number', required: false })
  @IsOptional()
  @IsString()
  @Matches(VALIDATION_PATTERNS.PAN, { message: USERS_ERRORS.INVALID_PAN })
  panNumber?: string;

  @ApiProperty({ description: 'Driving license number', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  dlNumber?: string;

  @ApiProperty({ description: 'UAN number (12 digits)', required: false })
  @IsOptional()
  @IsString()
  @Matches(VALIDATION_PATTERNS.UAN, { message: USERS_ERRORS.INVALID_UAN })
  uanNumber?: string;

  @ApiProperty({ description: 'Passport number', required: false })
  @IsOptional()
  @IsString()
  @Matches(VALIDATION_PATTERNS.PASSPORT, { message: USERS_ERRORS.INVALID_PASSPORT })
  passportNumber?: string;
}
