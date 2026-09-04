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

  /**
   * Declared before the `:id` routes on purpose. There is no actual collision — `:id/vendors`
   * needs the literal `vendors` in the third segment and this has `assignable` — but keeping
   * static paths above parameterised ones avoids a surprise if either route is renamed.
   */
  @Get('vendors/assignable')
  @RequiredPermission('financials.site-vendors.view')
  @ApiOperation({
    summary: 'Sites the current user may assign vendors to (FE section gating + site picker)',
    description:
      'Returns { allowed, sites }. Non-bypass users get only the sites where they are the ' +
      'Project Manager and currently allocated; office roles get every site. FE should treat a ' +
      '403 the same as allowed=false and hide the vendor section.',
  })
  async assignableSites(
    @Request() { user: { id: userId, activeRole } }: { user: { id: string; activeRole?: string } },
  ) {
    return await this.siteVendorService.getAssignableSites(userId, activeRole);
  }

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
