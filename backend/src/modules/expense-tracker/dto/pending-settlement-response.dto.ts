import { ApiProperty } from '@nestjs/swagger';

export class PendingSettlementRecordDto {
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

export class PendingSettlementSummaryDto {
  @ApiProperty({ example: 150000.0 })
  totalApprovedAmount: number;

  @ApiProperty({ example: 60000.0 })
  totalSettledAmount: number;

  @ApiProperty({ example: 90000.0 })
  totalPendingAmount: number;
}

export class PendingSettlementResponseDto {
  @ApiProperty({ type: [PendingSettlementRecordDto] })
  records: PendingSettlementRecordDto[];

  @ApiProperty({ example: 25 })
  totalRecords: number;

  @ApiProperty({ type: PendingSettlementSummaryDto })
  summary: PendingSettlementSummaryDto;
}
