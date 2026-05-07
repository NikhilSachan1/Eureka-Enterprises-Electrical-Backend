import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsString, IsOptional, ArrayMinSize, IsEmail } from 'class-validator';

export class SendPaymentAdviceEmailDto {
  @ApiProperty({ description: 'List of recipient email addresses', type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsEmail({}, { each: true })
  to: string[];

  @ApiPropertyOptional({ description: 'List of CC email addresses', type: [String] })
  @IsArray()
  @IsEmail({}, { each: true })
  @IsOptional()
  cc?: string[];

  @ApiProperty({ description: 'Email subject' })
  @IsString()
  subject: string;

  @ApiProperty({ description: 'Email body' })
  @IsString()
  body: string;

  @ApiPropertyOptional({ description: 'S3 keys of attachments', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attachmentKeys?: string[];
}
