import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RequiredPermission } from 'src/modules/auth/decorators/required-permission.decorator';
import { BillingService } from './billing.service';
import { GetPoSummaryDto, GetSiteSummaryDto, GetSiteClosingReadinessDto } from './dto';

@ApiTags('Billing')
@ApiBearerAuth('JWT-auth')
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('po-summary')
  @RequiredPermission('financials.billing.view')
  @ApiOperation({ summary: 'Get PO-wise summary per BRD §8' })
  getPoSummary(@Query() dto: GetPoSummaryDto) {
    return this.billingService.getPoSummary(dto);
  }

  @Get('site-summary')
  @RequiredPermission('financials.billing.view')
  @ApiOperation({ summary: 'Get site-level summary aggregated across all POs' })
  getSiteSummary(@Query() dto: GetSiteSummaryDto) {
    return this.billingService.getSiteSummary(dto);
  }

  @Get('site-closing-readiness')
  @RequiredPermission('financials.billing.view')
  @ApiOperation({ summary: 'Get site closing readiness per BRD §9' })
  getSiteClosingReadiness(@Query() dto: GetSiteClosingReadinessDto) {
    return this.billingService.getSiteClosingReadiness(dto);
  }
}
