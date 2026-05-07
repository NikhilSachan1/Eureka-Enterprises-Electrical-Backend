import { IsArray, IsUUID, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ManageSiteVendorsDto {
  @ApiProperty({
    description: 'Array of vendor IDs',
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsNotEmpty({ each: true })
  vendorIds: string[];
}
