import { IsNotEmpty, IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class DeallocateSiteDto {
  @IsNotEmpty()
  @IsDateString()
  deallocatedAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}
