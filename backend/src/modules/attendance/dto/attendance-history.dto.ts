import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class AttendanceHistoryDto {
  @ApiProperty({ description: 'The date of the attendance', example: '2021-01-01', required: true })
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @ApiProperty({
    description: 'The id of the user of whom the attendance is regularizing',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  userId: string;
}
