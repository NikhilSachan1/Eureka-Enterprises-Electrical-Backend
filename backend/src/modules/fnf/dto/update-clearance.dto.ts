import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString, MaxLength } from 'class-validator';
import { ClearanceStatus, FNF_DTO_ERRORS } from '../constants/fnf.constants';

export class UpdateClearanceDto {
  @ApiPropertyOptional({
    description: 'Assets clearance status',
    enum: ClearanceStatus,
  })
  @IsOptional()
  @IsEnum(ClearanceStatus, {
    message: FNF_DTO_ERRORS.INVALID_FNF_STATUS.replace(
      '{clearanceStatuses}',
      Object.values(ClearanceStatus).join(', '),
    ),
  })
  assetsClearanceStatus?: ClearanceStatus;

  @ApiPropertyOptional({
    description: 'Vehicles clearance status',
    enum: ClearanceStatus,
  })
  @IsOptional()
  @IsEnum(ClearanceStatus, {
    message: FNF_DTO_ERRORS.INVALID_FNF_STATUS.replace(
      '{clearanceStatuses}',
      Object.values(ClearanceStatus).join(', '),
    ),
  })
  vehiclesClearanceStatus?: ClearanceStatus;

  @ApiPropertyOptional({
    description: 'Cards clearance status',
    enum: ClearanceStatus,
  })
  @IsOptional()
  @IsEnum(ClearanceStatus, {
    message: FNF_DTO_ERRORS.INVALID_FNF_STATUS.replace(
      '{clearanceStatuses}',
      Object.values(ClearanceStatus).join(', '),
    ),
  })
  cardsClearanceStatus?: ClearanceStatus;

  @ApiPropertyOptional({
    description: 'Clearance remarks',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  clearanceRemarks?: string;
}
