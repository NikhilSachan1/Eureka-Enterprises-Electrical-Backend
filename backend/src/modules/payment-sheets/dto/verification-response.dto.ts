import { ApiProperty } from '@nestjs/swagger';

/** One (item × stage) verification record, as returned inside a sheet item. */
export class ItemVerificationDto {
  @ApiProperty({ example: 'HR_REVIEW' }) stage: string;
  @ApiProperty() verifiedBy: string;
  @ApiProperty({ nullable: true }) verifiedByName: string | null;
  @ApiProperty() verifiedAt: string;
}

/** Per-current-stage verification progress on a sheet (null when the stage doesn't verify). */
export class VerificationSummaryDto {
  @ApiProperty({ example: 'HR_REVIEW' }) stage: string;
  @ApiProperty({ example: 97 }) verified: number;
  @ApiProperty({ example: 100 }) total: number;
  @ApiProperty() allVerified: boolean;
}
