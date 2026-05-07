import { IsArray, IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BulkDeleteVendorDto {
  @ApiProperty({
    description: 'Array of vendor IDs to delete',
    example: ['123e4567-e89b-12d3-a456-426614174000', '123e4567-e89b-12d3-a456-426614174001'],
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsNotEmpty({ each: true })
  vendorIds: string[];

  // Set by the controller
  deletedBy?: string;
}
