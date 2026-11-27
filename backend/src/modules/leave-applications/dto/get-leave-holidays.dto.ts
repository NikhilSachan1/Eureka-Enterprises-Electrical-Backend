import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

export class GetLeaveHolidaysDto {
  @ApiProperty({ example: '2026-2027', required: false, description: 'Default: current FY' })
  @IsOptional()
  @Matches(/^\d{4}-\d{4}$/, { message: 'financialYear must look like 2026-2027' })
  financialYear?: string;
}
