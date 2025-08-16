import { ApiProperty } from '@nestjs/swagger';

export class ExpenseHistoryUserDto {
  @ApiProperty({
    description: 'User first name',
    example: 'John',
  })
  firstName: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
  })
  lastName: string;

  @ApiProperty({
    description: 'User email',
    example: 'john.doe@example.com',
  })
  email: string;
}

export class ExpenseHistoryItemDto {
  @ApiProperty({
    description: 'Expense ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Version number',
    example: 1,
  })
  versionNumber: number;

  @ApiProperty({
    description: 'Expense amount',
    example: 100,
  })
  amount: number;

  @ApiProperty({
    description: 'Expense category',
    example: 'Travel',
  })
  category: string;

  @ApiProperty({
    description: 'Expense description',
    example: 'Flight to Paris',
  })
  description: string;

  @ApiProperty({
    description: 'Expense date',
    example: '2021-01-01',
  })
  expenseDate: Date;

  @ApiProperty({
    description: 'Expense approval status',
    example: 'pending',
  })
  approvalStatus: string;

  @ApiProperty({
    description: 'Expense is active',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Expense edit reason',
    example: 'Flight to Paris',
  })
  editReason: string;

  @ApiProperty({
    description: 'Expense created at',
    example: '2021-01-01',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Expense updated at',
    example: '2021-01-01',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'Expense created by',
    example: 'John',
  })
  createdBy: string;

  @ApiProperty({
    description: 'Expense updated by',
    example: 'John',
  })
  updatedBy: string;

  @ApiProperty({
    description: 'Expense user',
    type: ExpenseHistoryUserDto,
  })
  user: ExpenseHistoryUserDto;
}

export class ExpenseHistoryResponseDto {
  @ApiProperty({
    description: 'Original expense ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  originalExpenseId: string;

  @ApiProperty({
    description: 'Current version number',
    example: 1,
  })
  currentVersion: number;

  @ApiProperty({
    description: 'Total number of versions',
    example: 1,
  })
  totalVersions: number;

  @ApiProperty({
    description: 'History of expense versions',
    type: [ExpenseHistoryItemDto],
  })
  history: ExpenseHistoryItemDto[];
}
