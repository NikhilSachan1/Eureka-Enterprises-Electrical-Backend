import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { UserStatus } from '../constants/user.constants';

export class CreateSystemUserDto {
  @ApiProperty({ description: 'First name', example: 'Mayank' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  firstName: string;

  @ApiProperty({ description: 'Last name', example: 'Sharma' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  lastName: string;

  @ApiProperty({ description: 'Email address, used to log in', example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email: string;

  @ApiProperty({ description: 'Contact number', example: '+919876543210' })
  @IsString()
  @IsNotEmpty()
  contactNumber: string;

  @ApiProperty({
    description: 'One or more role names. EMPLOYEE and DRIVER are not allowed.',
    example: ['ADMIN'],
    type: [String],
  })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one role is required' })
  @IsString({ each: true })
  roles: string[];
}

export class UpdateSystemUserDto extends PartialType(OmitType(CreateSystemUserDto, ['roles'])) {
  @ApiProperty({
    description: 'ACTIVE or ARCHIVED. A user must be archived before deletion.',
    required: false,
    enum: [UserStatus.ACTIVE, UserStatus.ARCHIVED],
  })
  @IsOptional()
  @IsIn([UserStatus.ACTIVE, UserStatus.ARCHIVED])
  status?: string;
}
