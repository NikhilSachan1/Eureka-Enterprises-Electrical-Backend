import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { DocumentMetricsService } from './document-metrics.service';
import { GetDocumentMetricsDto } from './dto/get-document-metrics.dto';
import { RequiredAnyPermission } from 'src/modules/auth/decorators/required-permission.decorator';

/**
 * Document metrics for the workspace tabs. Kept apart from DocumentStatusController, whose
 * office-only role guard would block site users who can see the document lists themselves;
 * the figures here are limited to the sites the user can read.
 */
@ApiTags('Document Status')
@ApiBearerAuth('JWT-auth')
@Controller('document-metrics')
export class DocumentMetricsController {
  constructor(private readonly documentMetricsService: DocumentMetricsService) {}

  @RequiredAnyPermission(
    'financials.purchase-orders.view-list',
    'financials.jmcs.view-list',
    'financials.site-reports.view-list',
    'financials.invoices.view-list',
    'financials.book-payments.view-list',
    'financials.advance-payments.view-list',
    'financials.gst.view-list',
    'financials.tds.view-list',
  )
  @Get()
  @ApiOperation({
    summary: 'Document counts and amounts for the workspace tabs',
    description:
      'Per document type (PO, JMC, report, invoice, book payment, advance): total / approved / ' +
      'pending / rejected, plus JMC signed copies missing, invoice settlement, bookings awaiting ' +
      'transfer and advance balance. All filters optional; with none, every site the user can read.',
  })
  getMetrics(
    @Query() query: GetDocumentMetricsDto,
    @GetUser('id') userId: string,
    @GetUser('activeRole') activeRole?: string,
  ) {
    return this.documentMetricsService.getMetrics(query, userId, activeRole);
  }
}
