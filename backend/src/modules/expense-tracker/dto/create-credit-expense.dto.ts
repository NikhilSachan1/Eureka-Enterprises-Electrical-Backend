import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { EXPENSE_TRACKER_ERRORS } from '../constants/expense-tracker.constants';

export class CreateCreditExpenseDto {
  @ApiProperty({
    description: 'User ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'Expense Category',
    example: 'Reimbursement',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  category: string;

  @ApiProperty({
    description: 'Expense Description',
    example: 'Reimbursement for travel',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Expense Amount',
    example: 100,
    required: true,
  })
  @IsNotEmpty()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0.01, { message: EXPENSE_TRACKER_ERRORS.AMOUNT_MUST_BE_GREATER_THAN_ZERO })
  amount: number;

  @ApiProperty({
    description: 'Transaction ID',
    example: '1234567890',
    required: false,
  })
  @IsOptional()
  @IsString()
  transactionId: string;

  @ApiProperty({
    description: 'Expense Date',
    example: '2021-01-01',
    required: true,
  })
  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  expenseDate: Date;

  @ApiProperty({
    description: 'Payment Mode',
    example: 'Cash',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  paymentMode: string;

  @ApiProperty({
    description: 'Files to be uploaded.',
    type: 'string',
    format: 'binary',
    isArray: true,
    maxItems: 10,
    required: true,
  })
  files: any;
}
