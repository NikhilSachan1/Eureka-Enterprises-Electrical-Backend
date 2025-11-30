import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { FUEL_EXPENSE_ERRORS } from '../constants/fuel-expense.constants';

/**
 * Edit Fuel Expense DTO
 * Used for editing existing fuel expense records with history tracking
 */
export class EditFuelExpenseDto {
  @ApiProperty({
    description: 'Vehicle ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: true,
  })
  @IsNotEmpty()
  @IsUUID()
  vehicleId: string;

  @ApiProperty({
    description: 'Card ID (optional - fuel card used)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  cardId?: string;

  @ApiProperty({
    description: 'Fill date and time',
    example: '2024-01-15T10:30:00Z',
    required: true,
  })
  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  fillDate: Date;

  @ApiProperty({
    description: 'Odometer reading in kilometers',
    example: 50000.5,
    required: true,
  })
  @IsNotEmpty()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0, { message: 'Odometer reading must be greater than or equal to 0' })
  odometerKm: number;

  @ApiProperty({
    description: 'Fuel quantity in liters',
    example: 45.5,
    required: true,
  })
  @IsNotEmpty()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0.01, { message: FUEL_EXPENSE_ERRORS.INVALID_FUEL_LITERS })
  fuelLiters: number;

  @ApiProperty({
    description: 'Fuel amount paid',
    example: 3500.75,
    required: true,
  })
  @IsNotEmpty()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0.01, { message: FUEL_EXPENSE_ERRORS.INVALID_FUEL_AMOUNT })
  fuelAmount: number;

  @ApiProperty({
    description: 'Pump meter reading (optional)',
    example: 12345.67,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => (value ? parseFloat(value) : undefined))
  @IsNumber()
  @Min(0)
  pumpMeterReading?: number;

  @ApiProperty({
    description: 'Payment mode (CARD, CASH, UPI, CREDIT)',
    example: 'CARD',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  paymentMode: string;

  @ApiProperty({
    description: 'Transaction ID (optional)',
    example: 'TXN123456789',
    required: false,
  })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiProperty({
    description: 'Description (optional)',
    example: 'Full tank fill at petrol pump',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Edit reason (optional)',
    example: 'Corrected odometer reading',
    required: false,
  })
  @IsOptional()
  @IsString()
  editReason?: string;

  @ApiProperty({
    description: 'Files to be uploaded (receipts)',
    type: 'string',
    format: 'binary',
    isArray: true,
    maxItems: 10,
    required: false,
  })
  @IsOptional()
  files?: any;
}
