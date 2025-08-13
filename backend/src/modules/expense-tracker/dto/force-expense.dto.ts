import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class ForceExpenseDto {
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
  @IsNumber()
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
}
