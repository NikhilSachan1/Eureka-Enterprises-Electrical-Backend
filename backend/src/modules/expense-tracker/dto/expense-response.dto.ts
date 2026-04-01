import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApprovalStatus } from '../constants/expense-tracker.constants';

export class ExpenseStatsDto {
  @ApiProperty({ example: { totalCredit: 100, totalDebit: 50, periodCredit: 50, periodDebit: 25 } })
  balances: {
    openingBalance: number;
    closingBalance: number;
    totalCredit: number;
    totalDebit: number;
    periodCredit: number;
    periodDebit: number;
  };

  @ApiProperty({ example: { pending: 3, approved: 4, rejected: 1, total: 8 } })
  approval: {
    pending: number;
    approved: number;
    rejected: number;
    total: number;
  };
}

export class ExpenseRecordDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  userId?: string;

  @ApiProperty()
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    employeeId: string;
  };

  @ApiPropertyOptional({ description: 'Submitter user id; only this user may edit when pending' })
  createdBy?: string | null;

  @ApiPropertyOptional()
  createdByUser?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    employeeId: string;
  } | null;

  @ApiProperty({
    description: 'Whether the authenticated user may edit this row (creator and pending only)',
  })
  canEdit: boolean;

  @ApiPropertyOptional()
  approvalByUser?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    employeeId: string;
  } | null;

  @ApiProperty()
  expenseDate: string;

  @ApiProperty()
  approvalStatus: ApprovalStatus;
}

export class ExpenseListResponseDto {
  @ApiProperty()
  stats?: ExpenseStatsDto;

  @ApiProperty({ type: [ExpenseRecordDto] })
  records: ExpenseRecordDto[];

  @ApiProperty({ example: 100 })
  totalRecords: number;
}
