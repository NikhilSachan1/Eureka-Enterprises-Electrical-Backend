import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import { Roles as RoleEnum } from 'src/modules/roles/constants/role.constants';
import { RequiredPermission } from 'src/modules/auth/decorators/required-permission.decorator';
import { DocumentStatusService } from './document-status.service';
import { GetDocumentStatusDto } from './dto/get-document-status.dto';
import { GetDocumentIssuesDto } from './dto/get-document-issues.dto';

@ApiTags('Document Status')
@ApiBearerAuth('JWT-auth')
@Roles(
  RoleEnum.SUPER_ADMIN,
  RoleEnum.ADMIN,
  RoleEnum.HR,
  RoleEnum.MANAGER,
  RoleEnum.OPERATION_MANAGER,
)
@Controller('document-status')
export class DocumentStatusController {
  constructor(private readonly documentStatusService: DocumentStatusService) {}

  @Get()
  @RequiredPermission('financials.document-status.view')
  @ApiOperation({
    summary: 'Site-level document chain summary',
    description:
      'Returns one record per site showing aggregated document health ' +
      '(PO → JMC → Report → Invoice → Book Payment → Bank Transfer) ' +
      'broken down separately for SALE and PURCHASE sides. ' +
      'Accepts one or more siteId values.',
  })
  async getSummary(@Query() query: GetDocumentStatusDto) {
    return await this.documentStatusService.getSummary(query);
  }

  @Get('issues')
  @RequiredPermission('financials.document-status.view')
  @ApiOperation({
    summary: 'JMC-level document chain drill-down',
    description:
      'Returns a paginated list of individual JMC chains with their full step-by-step ' +
      'status (overallStatus + nextAction + chain detail). ' +
      'By default excludes COMPLETE chains; pass includeComplete=true to see all. ' +
      'Filterable by overallStatus[], partyType, and date range.',
  })
  async getIssues(@Query() query: GetDocumentIssuesDto) {
    return await this.documentStatusService.getIssues(query);
  }
}
