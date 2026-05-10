import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RequiredPermission } from 'src/modules/auth/decorators/required-permission.decorator';
import { PurchaseOrderService } from './purchase-order.service';
import {
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
  GetPurchaseOrderDto,
  ApproveDto,
  RejectDto,
  UnlockRequestDto,
} from './dto';

@ApiTags('Purchase Orders')
@ApiBearerAuth('JWT-auth')
@Controller('purchase-orders')
export class PurchaseOrderController {
  constructor(private readonly poService: PurchaseOrderService) {}

  @Post()
  @RequiredPermission('financials.purchase-orders.create')
  @ApiOperation({ summary: 'Create a Purchase Order' })
  async create(
    @Request() { user: { id: createdBy } }: { user: { id: string } },
    @Body() dto: CreatePurchaseOrderDto,
  ) {
    return await this.poService.create(dto, createdBy);
  }

  @Get('dropdown')
  @RequiredPermission('financials.purchase-orders.view')
  @ApiOperation({
    summary: 'PO dropdown for JMC creation',
    description:
      'Returns all POs for a site+partyType with eligibility flags. ' +
      'Eligible items can be selected; ineligible items should be disabled in the UI ' +
      'and the reason displayed as a tooltip. ' +
      'Used to populate the PO dropdown when creating a JMC.',
  })
  async getDropdown(@Query('siteId') siteId: string, @Query('partyType') partyType: string) {
    return await this.poService.getDropdown(siteId, partyType);
  }

  @Get()
  @RequiredPermission('financials.purchase-orders.view')
  @ApiOperation({ summary: 'List POs' })
  async findAll(@Query() query: GetPurchaseOrderDto) {
    return await this.poService.findAll(query);
  }

  @Get(':id')
  @RequiredPermission('financials.purchase-orders.view')
  @ApiOperation({ summary: 'Get a PO by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.poService.findById(id);
  }

  @Patch(':id')
  @RequiredPermission('financials.purchase-orders.update')
  @ApiOperation({ summary: 'Update a PO (only when PENDING + unlocked)' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: updatedBy } }: { user: { id: string } },
    @Body() dto: UpdatePurchaseOrderDto,
  ) {
    return await this.poService.update(id, dto, updatedBy);
  }

  @Delete(':id')
  @RequiredPermission('financials.purchase-orders.delete')
  @ApiOperation({ summary: 'Delete a PO (only when PENDING + unlocked + no children)' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: deletedBy } }: { user: { id: string } },
  ) {
    return await this.poService.remove(id, deletedBy);
  }

  @Post(':id/approve')
  @RequiredPermission('financials.purchase-orders.approve')
  @ApiOperation({ summary: 'Approve a PO (admin)' })
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: approvedBy } }: { user: { id: string } },
    @Body() dto: ApproveDto,
  ) {
    return await this.poService.approve(id, dto, approvedBy);
  }

  @Post(':id/reject')
  @RequiredPermission('financials.purchase-orders.approve')
  @ApiOperation({ summary: 'Reject a PO (admin)' })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: rejectedBy } }: { user: { id: string } },
    @Body() dto: RejectDto,
  ) {
    return await this.poService.reject(id, dto, rejectedBy);
  }

  @Post(':id/unlock-request')
  @RequiredPermission('financials.purchase-orders.update')
  @ApiOperation({ summary: 'Request unlock on an approved PO' })
  async requestUnlock(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: requestedBy } }: { user: { id: string } },
    @Body() dto: UnlockRequestDto,
  ) {
    return await this.poService.requestUnlock(id, dto, requestedBy);
  }

  @Post(':id/unlock-grant')
  @RequiredPermission('financials.purchase-orders.unlock')
  @ApiOperation({ summary: 'Grant unlock — admin (resets to PENDING)' })
  async grantUnlock(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: grantedBy } }: { user: { id: string } },
  ) {
    return await this.poService.grantUnlock(id, grantedBy);
  }

  @Post(':id/unlock-reject')
  @RequiredPermission('financials.purchase-orders.unlock')
  @ApiOperation({ summary: 'Reject unlock request — admin (document stays locked)' })
  async rejectUnlock(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user: { id: rejectedBy } }: { user: { id: string } },
  ) {
    return await this.poService.rejectUnlock(id, rejectedBy);
  }
}
