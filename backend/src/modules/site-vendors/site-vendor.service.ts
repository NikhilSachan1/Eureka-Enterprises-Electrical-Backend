import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { In, IsNull } from 'typeorm';
import { SiteVendorRepository } from './site-vendor.repository';
import { VendorRepository } from 'src/modules/vendors/vendor.repository';
import { SiteRepository } from 'src/modules/sites/site.repository';
import { VENDOR_ERRORS } from 'src/modules/vendors/constants/vendor.constants';
import { SITE_ERRORS } from 'src/modules/sites/constants/site.constants';
import { SITE_VENDOR_ERRORS, SITE_VENDOR_RESPONSES } from './constants/site-vendor.constants';

@Injectable()
export class SiteVendorService {
  constructor(
    private readonly siteVendorRepository: SiteVendorRepository,
    private readonly vendorRepository: VendorRepository,
    private readonly siteRepository: SiteRepository,
  ) {}

  async listVendorsForSite(siteId: string) {
    await this.assertSiteExists(siteId);
    const rows = await this.siteVendorRepository.getVendorsBySiteId(siteId);
    return rows
      .filter((r) => r.vendor && !r.vendor.deletedAt)
      .map((r) => r.vendor);
  }

  async addVendorsToSite(siteId: string, vendorIds: string[]) {
    await this.assertSiteExists(siteId);
    await this.assertVendorsExist(vendorIds);

    const existing = await this.siteVendorRepository.getVendorsBySiteId(siteId);
    const existingIds = new Set(existing.map((e) => e.vendorId));
    const toInsert = vendorIds.filter((id) => !existingIds.has(id));

    if (toInsert.length > 0) {
      await this.siteVendorRepository.addVendors(siteId, toInsert);
    }

    return {
      message: SITE_VENDOR_RESPONSES.VENDORS_LINKED,
      addedCount: toInsert.length,
      skippedCount: vendorIds.length - toInsert.length,
    };
  }

  async removeVendorsFromSite(siteId: string, vendorIds: string[]) {
    await this.assertSiteExists(siteId);
    await this.siteVendorRepository.removeVendors(siteId, vendorIds);
    return { message: SITE_VENDOR_RESPONSES.VENDORS_UNLINKED, removedCount: vendorIds.length };
  }

  private async assertSiteExists(siteId: string) {
    const site = await this.siteRepository.findOne({ where: { id: siteId, deletedAt: IsNull() } });
    if (!site) throw new NotFoundException(SITE_ERRORS.NOT_FOUND);
  }

  private async assertVendorsExist(vendorIds: string[]) {
    if (!vendorIds.length) {
      throw new BadRequestException(SITE_VENDOR_ERRORS.VENDOR_IDS_REQUIRED);
    }
    const vendors = await this.vendorRepository.findAll({
      where: { id: In(vendorIds), deletedAt: IsNull() },
    });
    if (vendors.length !== vendorIds.length) {
      throw new NotFoundException(VENDOR_ERRORS.NOT_FOUND);
    }
  }
}
