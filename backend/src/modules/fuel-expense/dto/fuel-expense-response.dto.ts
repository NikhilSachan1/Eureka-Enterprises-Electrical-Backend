import { ApiProperty } from '@nestjs/swagger';
import { ApprovalStatus } from '../constants/fuel-expense.constants';

export class FuelExpenseStatsDto {
  @ApiProperty({
    description: 'Balance information including opening, closing, and period totals',
    example: {
      openingBalance: 1000,
      closingBalance: 1500,
      totalCredit: 800,
      totalDebit: 300,
      totalCreditCardExpense: 150,
      periodCredit: 500,
      periodDebit: 200,
    },
  })
  balances: {
    openingBalance: number;
    closingBalance: number;
    totalCredit: number;
    totalDebit: number;
    totalCreditCardExpense: number;
    periodCredit: number;
    periodDebit: number;
  };

  @ApiProperty({
    description: 'Approval status counts',
    example: { pending: 3, approved: 10, rejected: 1, total: 14 },
  })
  approval: {
    pending: number;
    approved: number;
    rejected: number;
    total: number;
  };

  @ApiProperty({
    description: 'Vehicle average fuel consumption (km per liter)',
    example: { average: 15.5, averageKmPerLiter: 15.5, vehicleId: 'uuid' },
    required: false,
  })
  vehicleAverage?: {
    average: number;
    averageKmPerLiter: number;
    vehicleId?: string;
  };
}

export class FuelExpenseRecordDto {
  @ApiProperty({ description: 'Fuel expense ID' })
  id: string;

  @ApiProperty({ description: 'User who created the expense' })
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    employeeId: string;
  };

  @ApiProperty({ description: 'Vehicle information' })
  vehicle: {
    id: string;
    registrationNumber: string;
    vehicleType: string;
    vehicleModel: string;
  };

  @ApiProperty({ description: 'Card information (if applicable)' })
  card?: {
    id: string;
    cardNumber: string;
    cardType: string;
  };

  @ApiProperty({ description: 'User who approved/rejected the expense' })
  approvalByUser?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    employeeId: string;
  };

  @ApiProperty({ description: 'Date when fuel was filled' })
  fillDate: Date;

  @ApiProperty({ description: 'Odometer reading in kilometers' })
  odometerKm: number;

  @ApiProperty({ description: 'Fuel quantity in liters' })
  fuelLiters: number;

  @ApiProperty({ description: 'Fuel amount in currency' })
  fuelAmount: number;

  @ApiProperty({ description: 'Pump meter reading (optional)' })
  pumpMeterReading?: number;

  @ApiProperty({ description: 'Payment mode used' })
  paymentMode: string;

  @ApiProperty({ description: 'Transaction ID (optional)' })
  transactionId?: string;

  @ApiProperty({ description: 'Description of the expense' })
  description?: string;

  @ApiProperty({ description: 'Transaction type (DEBIT/CREDIT)' })
  transactionType: string;

  @ApiProperty({ description: 'Expense entry type (SELF/FORCED)' })
  expenseEntryType: string;

  @ApiProperty({ description: 'Entry source type' })
  entrySourceType: string;

  @ApiProperty({ description: 'Approval status', enum: ApprovalStatus })
  approvalStatus: ApprovalStatus;

  @ApiProperty({ description: 'Approval by user ID' })
  approvalBy?: string;

  @ApiProperty({ description: 'Approval date' })
  approvalAt?: Date;

  @ApiProperty({ description: 'Approval reason/comment' })
  approvalReason?: string;

  @ApiProperty({ description: 'Created date' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated date' })
  updatedAt: Date;

  @ApiProperty({ description: 'Attached file keys', type: [String] })
  fileKeys: string[];

  @ApiProperty({
    description: 'Fuel efficiency data for this fill (distance traveled from previous fill)',
    example: {
      distanceTraveled: 450,
      kmPerLiter: 15.5,
      previousOdometerKm: 14550,
    },
    required: false,
  })
  fuelEfficiency?: {
    distanceTraveled: number;
    kmPerLiter: number;
    previousOdometerKm: number;
  };
}

export class FuelExpenseListResponseDto {
  @ApiProperty({ description: 'Statistics and summary data' })
  stats?: FuelExpenseStatsDto;

  @ApiProperty({ description: 'List of fuel expense records', type: [FuelExpenseRecordDto] })
  records: FuelExpenseRecordDto[];

  @ApiProperty({ description: 'Total number of records', example: 100 })
  totalRecords: number;
}
