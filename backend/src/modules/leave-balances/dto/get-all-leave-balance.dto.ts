import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { BaseGetDto } from 'src/utils/base-dto/base-get-dto';

export class GetAllLeaveBalanceDto extends BaseGetDto {
  @ApiProperty({
    description: 'The ID of the user',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  @IsString()
  userId?: string;

  @ApiProperty({
    description: 'financial year',
    example: '2025',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  financialYear: string;
}
