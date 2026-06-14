import { ApiProperty } from '@nestjs/swagger';

export class FuelPendingSettlementRecordDto {
  @ApiProperty({ example: 'uuid' })
  userId: string;

  @ApiProperty({ example: 'John Doe' })
  userName: string;

  @ApiProperty({ example: 'EMP001' })
  employeeId: string;

  @ApiProperty({ example: 'john@example.com' })
  email: string;

  @ApiProperty({ example: 5000.0 })
  totalApprovedAmount: number;

  @ApiProperty({ example: 2000.0 })
  totalSettledAmount: number;

  @ApiProperty({ example: 3000.0 })
  pendingAmount: number;
}

export class FuelPendingSettlementSummaryDto {
  @ApiProperty({ example: 150000.0 })
  totalApprovedAmount: number;

  @ApiProperty({ example: 60000.0 })
  totalSettledAmount: number;

  @ApiProperty({ example: 90000.0 })
  totalPendingAmount: number;
}

export class FuelPendingSettlementResponseDto {
  @ApiProperty({ type: [FuelPendingSettlementRecordDto] })
  records: FuelPendingSettlementRecordDto[];

  @ApiProperty({ example: 25 })
  totalRecords: number;

  @ApiProperty({ type: FuelPendingSettlementSummaryDto })
  summary: FuelPendingSettlementSummaryDto;
}
