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
import { ApprovalStatus } from '../constants/expense-tracker.constants';
import { Type } from 'class-transformer';

export class ExpenseApprovalDto {
  @ApiProperty({
    description: 'Expense record ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  expenseId: string;

  @ApiProperty({ description: 'The approval status of the expense', example: 'approved' })
  @IsString()
  @IsNotEmpty()
  @IsEnum([ApprovalStatus.APPROVED, ApprovalStatus.REJECTED])
  approvalStatus: string;

  @ApiProperty({
    description: 'The approval comment of the expense',
    example: 'Reason for rejection or approval comment',
  })
  @ValidateIf((obj) => obj.approvalStatus === ApprovalStatus.REJECTED)
  @IsNotEmpty({ message: 'Approval comment is required when rejecting expense' })
  @IsString()
  @IsOptional()
  approvalComment: string;
}

export class ExpenseBulkApprovalDto {
  @ApiProperty({ type: [ExpenseApprovalDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExpenseApprovalDto)
  approvals: ExpenseApprovalDto[];

  approvalBy?: string;
}
