import { Controller, Get, Post, Delete, Param, Body, Request, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequiredPermission } from 'src/modules/auth/decorators/required-permission.decorator';
import { SiteVendorService } from './site-vendor.service';
import { ManageSiteVendorsDto } from './dto';

@ApiTags('Site Vendors')
@ApiBearerAuth('JWT-auth')
@Controller('sites')
export class SiteVendorController {
  constructor(private readonly siteVendorService: SiteVendorService) {}

  @Get(':id/vendors')
  @RequiredPermission('financials.site-vendors.view')
  @ApiOperation({ summary: 'List vendors linked to a site' })
  async listVendors(@Param('id', ParseUUIDPipe) siteId: string) {
    return await this.siteVendorService.listVendorsForSite(siteId);
  }

  @Post(':id/vendors')
  @RequiredPermission('financials.site-vendors.assign')
  @ApiOperation({
    summary: 'Link vendors to a site',
    description:
      'Restricted to the site Project Manager (site_allocations.role = Project Manager, ' +
      'currently allocated). Office roles bypass the allocation check.',
  })
  async addVendors(
    @Request() { user: { id: userId, activeRole } }: { user: { id: string; activeRole?: string } },
    @Param('id', ParseUUIDPipe) siteId: string,
    @Body() body: ManageSiteVendorsDto,
  ) {
    return await this.siteVendorService.addVendorsToSite(
      siteId,
      body.vendorIds,
      userId,
      activeRole,
    );
  }

  @Delete(':id/vendors')
  @RequiredPermission('financials.site-vendors.unassign')
  @ApiOperation({
    summary: 'Unlink vendors from a site',
    description:
      'Restricted to the site Project Manager (site_allocations.role = Project Manager, ' +
      'currently allocated). Office roles bypass the allocation check.',
  })
  async removeVendors(
    @Request() { user: { id: userId, activeRole } }: { user: { id: string; activeRole?: string } },
    @Param('id', ParseUUIDPipe) siteId: string,
    @Body() body: ManageSiteVendorsDto,
  ) {
    return await this.siteVendorService.removeVendorsFromSite(
      siteId,
      body.vendorIds,
      userId,
      activeRole,
    );
  }
}
