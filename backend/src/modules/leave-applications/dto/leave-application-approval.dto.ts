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
import { ApprovalStatus } from '../constants/leave-application.constants';
import { AttendanceStatus } from 'src/modules/attendance/constants/attendance.constants';
import { Type } from 'class-transformer';

export class LeaveApprovalDto {
  @ApiProperty({
    description: 'Leave application ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  leaveApplicationId: string;

  @ApiProperty({ description: 'The approval status of the leave application', example: 'approved' })
  @IsString()
  @IsNotEmpty()
  @IsEnum([ApprovalStatus.APPROVED, ApprovalStatus.REJECTED, ApprovalStatus.CANCELLED])
  approvalStatus: string;

  @ApiProperty({
    description: 'The approval comment of the leave application (mandatory for rejection)',
    example: 'Reason for rejection or approval comment',
  })
  @ValidateIf((obj) => obj.approvalStatus === ApprovalStatus.REJECTED)
  @IsNotEmpty({ message: 'Approval comment is required when rejecting leave application' })
  @IsString()
  @IsOptional()
  approvalComment: string;

  @ApiProperty({
    description: 'The attendance status (required when leave date is current date or earlier)',
    example: 'present',
  })
  @IsString()
  @IsEnum([AttendanceStatus.PRESENT, AttendanceStatus.ABSENT])
  @IsOptional()
  attendanceStatus: string;
}

export class LeaveBulkApprovalDto {
  @ApiProperty({ type: [LeaveApprovalDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LeaveApprovalDto)
  approvals: LeaveApprovalDto[];

  approvalBy?: string;
  timezone?: string;
}
