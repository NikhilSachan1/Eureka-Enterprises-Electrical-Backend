import { IsArray, IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BulkDeleteCompanyDto {
  @ApiProperty({
    description: 'Array of company IDs to delete',
    example: ['123e4567-e89b-12d3-a456-426614174000', '123e4567-e89b-12d3-a456-426614174001'],
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsNotEmpty({ each: true })
  companyIds: string[];

  // These will be set by the controller
  deletedBy?: string;
}
