import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { FUEL_EXPENSE_ERRORS } from '../constants/fuel-expense.constants';

/**
 * Create Credit Fuel Expense DTO
 * Used for settling/reimbursing fuel expenses to employees
 */
export class CreateCreditFuelExpenseDto {
  @ApiProperty({
    description: 'User ID - the employee whose expense is being settled',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: true,
  })
  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'Settlement amount',
    example: 3500.75,
    required: true,
  })
  @IsNotEmpty()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0.01, { message: FUEL_EXPENSE_ERRORS.INVALID_FUEL_AMOUNT })
  fuelAmount: number;

  @ApiProperty({
    description: 'Settlement date',
    example: '2024-01-15',
    required: true,
  })
  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  fillDate: Date;

  @ApiProperty({
    description: 'Payment mode (CARD, CASH, UPI, BANK_TRANSFER)',
    example: 'BANK_TRANSFER',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  paymentMode: string;

  @ApiProperty({
    description: 'Transaction/Reference ID (optional)',
    example: 'TXN123456789',
    required: false,
  })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiProperty({
    description: 'Description/Notes (optional)',
    example: 'Fuel expense settlement for December 2024',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Files to be uploaded (payment receipts)',
    type: 'string',
    format: 'binary',
    isArray: true,
    maxItems: 10,
    required: false,
  })
  @IsOptional()
  files?: any;
}
