import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { EXPENSE_TRACKER_ERRORS } from '../constants/expense-tracker.constants';

export class CreateDebitExpenseDto {
  /**
   * Whose expense this is. Omit for your own.
   *
   * Only accepted for somebody you have been delegated — see `GET /user-delegations/managed-users`
   * for who that is. The money stays theirs; the record keeps you as the person who entered it,
   * which is also what decides who may edit it afterwards.
   */
  @ApiPropertyOptional({
    description: 'Whose expense this is. Omit for your own. Must be someone you manage.',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({
    description: 'Expense Category',
    example: 'Travel',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  category: string;

  @ApiProperty({
    description: 'Expense Description',
    example: 'Flight to Paris',
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
