import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { CreateCompanyDto } from './create-company.dto';

export class UpdateCompanyDto extends PartialType(CreateCompanyDto) {
  @ApiProperty({
    description: 'Whether the company is active',
    example: true,
    required: false,
  })
  @IsOptional()
  @Transform(({ value, key, obj }) => {
    // Read from source object to bypass enableImplicitConversion coercing 'false' → true
    const raw = obj?.[key] ?? value;
    if (raw === false || raw === 'false' || raw === 0 || raw === '0') return false;
    if (raw === true || raw === 'true' || raw === 1 || raw === '1') return true;
    return undefined;
  })
  @IsBoolean()
  isActive?: boolean;
}
