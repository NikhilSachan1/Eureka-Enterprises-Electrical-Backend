import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SiteVendorService } from './site-vendor.service';
import { ManageSiteVendorsDto } from './dto';

@ApiTags('Site Vendors')
@ApiBearerAuth('JWT-auth')
@Controller('sites')
export class SiteVendorController {
  constructor(private readonly siteVendorService: SiteVendorService) {}

  @Get(':id/vendors')
  @ApiOperation({ summary: 'List vendors linked to a site' })
  async listVendors(@Param('id', ParseUUIDPipe) siteId: string) {
    return await this.siteVendorService.listVendorsForSite(siteId);
  }

  @Post(':id/vendors')
  @ApiOperation({ summary: 'Link vendors to a site' })
  async addVendors(
    @Param('id', ParseUUIDPipe) siteId: string,
    @Body() body: ManageSiteVendorsDto,
  ) {
    return await this.siteVendorService.addVendorsToSite(siteId, body.vendorIds);
  }

  @Delete(':id/vendors')
  @ApiOperation({ summary: 'Unlink vendors from a site' })
  async removeVendors(
    @Param('id', ParseUUIDPipe) siteId: string,
    @Body() body: ManageSiteVendorsDto,
  ) {
    return await this.siteVendorService.removeVendorsFromSite(siteId, body.vendorIds);
  }
}
