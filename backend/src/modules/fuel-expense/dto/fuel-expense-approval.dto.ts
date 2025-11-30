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
import { ApprovalStatus } from '../constants/fuel-expense.constants';
import { Type } from 'class-transformer';

export class FuelExpenseApprovalDto {
  @ApiProperty({
    description: 'Fuel expense record ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  fuelExpenseId: string;

  @ApiProperty({
    description: 'The approval status of the fuel expense',
    example: 'APPROVED',
    enum: ApprovalStatus,
  })
  @IsString()
  @IsNotEmpty()
  @IsEnum([ApprovalStatus.APPROVED, ApprovalStatus.REJECTED])
  approvalStatus: string;

  @ApiProperty({
    description: 'The approval reason/comment',
    example: 'Reason for rejection or approval comment',
    required: false,
  })
  @ValidateIf((obj) => obj.approvalStatus === ApprovalStatus.REJECTED)
  @IsNotEmpty({ message: 'Approval reason is required when rejecting fuel expense' })
  @IsString()
  @IsOptional()
  approvalReason?: string;
}

export class FuelExpenseBulkApprovalDto {
  @ApiProperty({ type: [FuelExpenseApprovalDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FuelExpenseApprovalDto)
  approvals: FuelExpenseApprovalDto[];

  approvalBy?: string;
}
