import { IsEnum, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { AttendanceType, AttendanceAction } from '../constants/attendance.constants';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EntrySourceType } from 'src/utils/master-constants/master-constants';
import { Type } from 'class-transformer';

class AssignmentSnapshotSiteDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  fullAddress?: string;
}

class AssignmentSnapshotCompanyDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  fullAddress?: string;
}

class AssignmentSnapshotContractorDto {
  @IsString()
  id: string;

  @IsString()
  name: string;
}

class AssignmentSnapshotVehicleDto {
  @IsString()
  id: string;

  @IsString()
  registrationNo: string;
}

class AssignmentSnapshotEngineerDto {
  @IsString()
  id: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  employeeId: string;
}

export class AssignmentSnapshotDto {
  @ApiPropertyOptional({ type: AssignmentSnapshotSiteDto })
  @ValidateNested()
  @Type(() => AssignmentSnapshotSiteDto)
  @IsOptional()
  site?: AssignmentSnapshotSiteDto;

  @ApiPropertyOptional({ type: AssignmentSnapshotCompanyDto })
  @ValidateNested()
  @Type(() => AssignmentSnapshotCompanyDto)
  @IsOptional()
  company?: AssignmentSnapshotCompanyDto;

  @ApiPropertyOptional({ type: [AssignmentSnapshotContractorDto] })
  @ValidateNested({ each: true })
  @Type(() => AssignmentSnapshotContractorDto)
  @IsOptional()
  contractors?: AssignmentSnapshotContractorDto[];

  @ApiPropertyOptional({ type: AssignmentSnapshotVehicleDto })
  @ValidateNested()
  @Type(() => AssignmentSnapshotVehicleDto)
  @IsOptional()
  vehicle?: AssignmentSnapshotVehicleDto;

  @ApiPropertyOptional({ type: AssignmentSnapshotEngineerDto })
  @ValidateNested()
  @Type(() => AssignmentSnapshotEngineerDto)
  @IsOptional()
  assignedEngineer?: AssignmentSnapshotEngineerDto;
}

export class AttendanceActionDto {
  @ApiProperty({
    description: 'The action to perform',
    enum: AttendanceAction,
    example: 'checkIn',
  })
  @IsNotEmpty()
  @IsEnum(AttendanceAction)
  action: AttendanceAction;

  @ApiProperty({
    description: 'The notes to perform',
    example: 'I am going to work',
  })
  @IsString()
  @IsOptional()
  notes?: string;

  @IsEnum(EntrySourceType)
  @IsOptional()
  entrySourceType?: EntrySourceType;

  @IsEnum(AttendanceType)
  @IsOptional()
  attendanceType?: AttendanceType;

  @IsString()
  @IsOptional()
  timezone?: string;

  @ApiPropertyOptional({
    description:
      'Assignment snapshot containing site, company, contractors, vehicle, and assigned engineer details',
    type: AssignmentSnapshotDto,
  })
  @ValidateNested()
  @Type(() => AssignmentSnapshotDto)
  @IsOptional()
  assignmentSnapshot?: AssignmentSnapshotDto;
}
