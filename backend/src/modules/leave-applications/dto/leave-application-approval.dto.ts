import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
  ValidateIf,
  IsEnum,
  IsIn,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ApprovalStatus } from '../constants/leave-application.constants';
import { AttendanceStatus } from 'src/modules/attendance/constants/attendance.constants';
import { Type } from 'class-transformer';

@ValidatorConstraint({ name: 'attendanceStatusMatchesApproval' })
class AttendanceStatusMatchesApproval implements ValidatorConstraintInterface {
  validate(value: string, args: ValidationArguments): boolean {
    if (!value) return true;

    const { approvalStatus } = args.object as LeaveApprovalDto;

    if (approvalStatus === ApprovalStatus.APPROVED) {
      return value === AttendanceStatus.LEAVE || value === AttendanceStatus.LEAVE_WITHOUT_PAY;
    }
    if (approvalStatus === ApprovalStatus.REJECTED) {
      return value === AttendanceStatus.PRESENT || value === AttendanceStatus.ABSENT;
    }

    return true;
  }

  defaultMessage(args: ValidationArguments): string {
    const { approvalStatus } = args.object as LeaveApprovalDto;

    if (approvalStatus === ApprovalStatus.APPROVED) {
      return 'When approving a leave, attendanceStatus must be "leave"';
    }
    if (approvalStatus === ApprovalStatus.REJECTED) {
      return 'When rejecting a leave, attendanceStatus must be "present" or "absent"';
    }

    return 'Invalid attendanceStatus for the given approvalStatus';
  }
}

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
    description:
      'Required when leave date is today or past. approve → "leave"/"leaveWithoutPay"; reject → "present"/"absent"',
    example: 'leave',
  })
  @IsOptional()
  @IsString()
  @IsIn([
    AttendanceStatus.PRESENT,
    AttendanceStatus.ABSENT,
    AttendanceStatus.LEAVE,
    AttendanceStatus.LEAVE_WITHOUT_PAY,
  ])
  @Validate(AttendanceStatusMatchesApproval)
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
