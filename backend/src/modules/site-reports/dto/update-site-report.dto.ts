import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateSiteReportDto } from './create-site-report.dto';

export class UpdateSiteReportDto extends PartialType(
  OmitType(CreateSiteReportDto, ['jmcId'] as const),
) {}
