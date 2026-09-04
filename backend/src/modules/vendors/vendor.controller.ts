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
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody } from '@nestjs/swagger';
import { RequiredPermission } from 'src/modules/auth/decorators/required-permission.decorator';
import { VendorService } from './vendor.service';
import { CreateVendorDto, UpdateVendorDto, GetVendorDto, BulkDeleteVendorDto } from './dto';

@ApiTags('Vendors')
@ApiBearerAuth('JWT-auth')
@Controller('vendors')
export class VendorController {
  constructor(private readonly vendorService: VendorService) {}

  @Post()
  @RequiredPermission('financials.vendors.create')
  @ApiOperation({
    summary: 'Create a vendor',
    description: 'Creates a new vendor record. Vendor type must be FREELANCER or GST_REGISTERED.',
  })
  async create(
    @Request() { user: { id: createdBy } }: { user: { id: string } },
    @Body() createVendorDto: CreateVendorDto,
  ) {
    return await this.vendorService.create(createVendorDto, createdBy);
  }

  @Get()
  @RequiredPermission('financials.vendors.view-list')
  @ApiOperation({
    summary: 'Get all vendors',
    description: 'Retrieves a list of vendors with optional filtering and pagination.',
  })
  async findAll(@Query() query: GetVendorDto) {
    return await this.vendorService.findAll(query);
  }

  @Get('next-code')
  @RequiredPermission('financials.vendors.create')
  @ApiOperation({
    summary: 'Preview the next vendor code',
    description: 'Returns the vendor code that would be assigned to the next created vendor.',
  })
  async nextCode() {
    return await this.vendorService.previewNextVendorCode();
  }

  @Get(':id')
  @RequiredPermission('financials.vendors.view-list')
  @ApiOperation({
    summary: 'Get a vendor by ID',
    description: 'Retrieves a specific vendor by its unique identifier.',
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.vendorService.findById(id);
  }

  @Patch(':id')
  @RequiredPermission('financials.vendors.update')
  @ApiOperation({
    summary: 'Update a vendor',
    description:
      'Updates an existing vendor record. Only the vendor creator may edit it; ' +
      'office roles retain a full override.',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Request()
    { user: { id: updatedBy, activeRole } }: { user: { id: string; activeRole?: string } },
    @Body() updateVendorDto: UpdateVendorDto,
  ) {
    return await this.vendorService.update(id, updateVendorDto, updatedBy, activeRole);
  }

  @Delete()
  @RequiredPermission('financials.vendors.delete')
  @ApiOperation({
    summary: 'Bulk delete vendors',
    description:
      'Soft-deletes multiple vendors. Skips ones with active site or financial associations.',
  })
  @ApiBody({ type: BulkDeleteVendorDto })
  async bulkDelete(
    @Request()
    { user: { id: deletedBy, activeRole } }: { user: { id: string; activeRole?: string } },
    @Body() bulkDeleteDto: BulkDeleteVendorDto,
  ) {
    return await this.vendorService.bulkDelete(bulkDeleteDto.vendorIds, deletedBy, activeRole);
  }

  @Delete(':id')
  @RequiredPermission('financials.vendors.delete')
  @ApiOperation({
    summary: 'Delete a vendor',
    description:
      'Soft deletes a vendor by its unique identifier. Only the vendor creator may ' +
      'delete it; office roles retain a full override.',
  })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request()
    { user: { id: deletedBy, activeRole } }: { user: { id: string; activeRole?: string } },
  ) {
    return await this.vendorService.remove(id, deletedBy, activeRole);
  }

  @Post(':id/restore')
  @RequiredPermission('financials.vendors.update')
  @ApiOperation({
    summary: 'Restore a deleted vendor',
    description: 'Restores a previously soft-deleted vendor back to active status.',
  })
  async restore(@Param('id', ParseUUIDPipe) id: string) {
    return await this.vendorService.restore(id);
  }
}
