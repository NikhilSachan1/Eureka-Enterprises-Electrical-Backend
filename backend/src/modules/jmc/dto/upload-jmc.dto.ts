import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

/**
 * Attach the signed JMC copy to an existing JMC record — no PO/contractor/date/number re-entry.
 */
export class UploadJmcDto {
  @ApiProperty({ description: 'S3 file key of the signed JMC' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  fileKey: string;

  @ApiProperty({ description: 'Original file name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName: string;
}
