import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { EXPENSE_TRACKER_ERRORS } from '../constants/expense-tracker.constants';
import { Transform, Type } from 'class-transformer';

export class CreditBonusExpenseDto {
  @ApiProperty({
    description: 'User ID - the employee receiving the bonus',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'Site ID - the site for which bonus is being credited',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  siteId: string;

  @ApiProperty({
    description: 'Expense Category',
    example: 'PERFORMANCE_BONUS',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  category: string;

  @ApiProperty({
    description: 'Bonus Amount',
    example: 5000,
    required: true,
  })
  @IsNotEmpty()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0.01, { message: EXPENSE_TRACKER_ERRORS.AMOUNT_MUST_BE_GREATER_THAN_ZERO })
  amount: number;

  @ApiProperty({
    description: 'Description/Reason for bonus',
    example: 'Performance bonus for Q1 2026',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Expense Date',
    example: '2026-03-01',
    required: true,
  })
  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  expenseDate: Date;

  @ApiProperty({
    description: 'Payment Mode',
    example: 'BANK_TRANSFER',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  paymentMode: string;

  @ApiPropertyOptional({
    description: 'Transaction ID',
    example: 'TXN123456',
    required: false,
  })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiPropertyOptional({
    description: 'Files to be uploaded.',
    type: 'string',
    format: 'binary',
    isArray: true,
    maxItems: 10,
    required: false,
  })
  files?: any;
}
