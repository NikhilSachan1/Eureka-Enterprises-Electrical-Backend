import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
  ValidateIf,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ApprovalStatus } from '../constants/attendance.constants';
import { Type } from 'class-transformer';

export class AttendanceApprovalDto {
  @ApiProperty({
    description: 'Attendance record ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  attendanceId: string;

  @ApiProperty({ description: 'The approval status of the attendance', example: 'approved' })
  @IsString()
  @IsNotEmpty()
  @IsEnum([ApprovalStatus.APPROVED, ApprovalStatus.REJECTED])
  approvalStatus: string;

  @ApiProperty({
    description: 'The approval comment of the attendance (mandatory for rejection)',
    example: 'Reason for rejection or approval comment',
  })
  @ValidateIf((obj) => obj.approvalStatus === ApprovalStatus.REJECTED)
  @IsNotEmpty({ message: 'Approval comment is required when rejecting attendance' })
  @IsString()
  @IsOptional()
  approvalComment: string;
}

export class AttendanceBulkApprovalDto {
  @ApiProperty({ type: [AttendanceApprovalDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendanceApprovalDto)
  approvals: AttendanceApprovalDto[];

  approvalBy?: string;
}
