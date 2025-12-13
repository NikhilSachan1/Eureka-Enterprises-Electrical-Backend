import {
  IsDate,
  IsEmail,
  IsOptional,
  IsString,
  IsInt,
  IsDateString,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUserDto {
  // ==================== Required Fields ====================
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  password: string;

  @IsString()
  contactNumber: string;

  @IsString()
  status: string;

  // ==================== Optional Basic Fields ====================
  @IsString()
  @IsOptional()
  profilePicture?: string;

  @IsDate()
  @IsOptional()
  passwordUpdatedAt?: Date;

  @IsString()
  @IsOptional()
  employeeId?: string;

  // ==================== Personal Information ====================
  @IsString()
  @IsOptional()
  @MaxLength(255)
  fatherName?: string;

  @IsString()
  @IsOptional()
  emergencyContactNumber?: string;

  @IsString()
  @IsOptional()
  gender?: string;

  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @IsString()
  @IsOptional()
  bloodGroup?: string;

  // ==================== Address Information ====================
  @IsString()
  @IsOptional()
  @MaxLength(100)
  houseNumber?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  streetName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  landmark?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  city?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  state?: string;

  @IsString()
  @IsOptional()
  pincode?: string;

  // ==================== Employment Details ====================
  @IsDateString()
  @IsOptional()
  dateOfJoining?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  previousExperience?: string;

  @IsString()
  @IsOptional()
  employeeType?: string;

  @IsString()
  @IsOptional()
  designation?: string;

  // ==================== Education Details ====================
  @IsString()
  @IsOptional()
  degree?: string;

  @IsString()
  @IsOptional()
  branch?: string;

  @IsInt()
  @IsOptional()
  @Min(1950)
  @Max(new Date().getFullYear() + 5)
  @Type(() => Number)
  passoutYear?: number;

  // ==================== Banking Details ====================
  @IsString()
  @IsOptional()
  @MaxLength(255)
  bankHolderName?: string;

  @IsString()
  @IsOptional()
  accountNumber?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  bankName?: string;

  @IsString()
  @IsOptional()
  ifscCode?: string;

  // ==================== Government IDs and Documents ====================
  @IsString()
  @IsOptional()
  esicNumber?: string;

  @IsString()
  @IsOptional()
  esicDoc?: string;

  @IsString()
  @IsOptional()
  aadharNumber?: string;

  @IsString()
  @IsOptional()
  aadharDoc?: string;

  @IsString()
  @IsOptional()
  panNumber?: string;

  @IsString()
  @IsOptional()
  panDoc?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  dlNumber?: string;

  @IsString()
  @IsOptional()
  dlDoc?: string;
}
