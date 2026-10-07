import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { AttendanceType, AttendanceAction } from '../constants/attendance.constants';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EntrySourceType } from 'src/utils/master-constants/master-constants';
import { Transform, Type } from 'class-transformer';

class AssignmentSnapshotVehicleDto {
  @IsString()
  id: string;

  @IsString()
  registrationNo: string;
}

// Validated more strictly than the rest of the snapshot: clients were sending an
// uninitialised `{id:"", firstName:"", ...}`, which bare @IsString() accepts, and it
// was then stored and served as a real engineer.
class AssignmentSnapshotEngineerDto {
  @IsUUID()
  id: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsNotEmpty()
  employeeId: string;
}

export class AssignmentSnapshotDto {
  /**
   * Drivers the engineer has with him today. This is an *instruction*, not stored data — it drives
   * rows in driver_day_assignments and is then stripped from the snapshot, so the pairing table
   * stays the single record and cannot drift from a copy held on the attendance row.
   *
   * It rides on the snapshot rather than the top level so that regularize, which already carries
   * the snapshot, becomes the correction path for free.
   */
  @ApiPropertyOptional({
    type: [String],
    description: 'User IDs of the drivers working with this engineer today (DRIVER role only)',
  })
  @Transform(({ value }) => (Array.isArray(value) ? value : value != null ? [value] : undefined))
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  assignedDrivers?: string[];

  /**
   * Accepted and ignored.
   *
   * The project is resolved from the employee's allocation for that date, and the company and
   * contractors follow from the project — none of the three is read from the request any more, and
   * the sanitiser drops them before anything is stored.
   *
   * They stay declared because validation runs with `forbidNonWhitelisted`: removing them would
   * turn an older mobile build's check-in into a 400 the moment the API deployed. Typed loosely on
   * purpose — nothing reads them, so there is nothing to validate. Same reasoning as
   * `assignedEngineer`, which has been accepted-and-dropped here for the same reason.
   */
  @ApiPropertyOptional({ deprecated: true, description: 'Ignored. Resolved from the allocation.' })
  @IsOptional()
  site?: unknown;

  @ApiPropertyOptional({ deprecated: true, description: 'Ignored. Follows from the project.' })
  @IsOptional()
  company?: unknown;

  @ApiPropertyOptional({ deprecated: true, description: 'Ignored. Follows from the project.' })
  @IsOptional()
  contractors?: unknown;

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
