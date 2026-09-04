import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource, In, IsNull } from 'typeorm';
import { checkSiteCreateAccess } from 'src/modules/common/financials/site-access.helper';
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
    private readonly dataSource: DataSource,
  ) {}

  async listVendorsForSite(siteId: string) {
    await this.assertSiteExists(siteId);
    const rows = await this.siteVendorRepository.getVendorsBySiteId(siteId);
    return rows.filter((r) => r.vendor && !r.vendor.deletedAt).map((r) => r.vendor);
  }

  async addVendorsToSite(siteId: string, vendorIds: string[], userId: string, activeRole?: string) {
    await this.assertSiteExists(siteId);
    await this.assertIsSitePm(siteId, userId, activeRole);
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

  async removeVendorsFromSite(
    siteId: string,
    vendorIds: string[],
    userId: string,
    activeRole?: string,
  ) {
    await this.assertSiteExists(siteId);
    await this.assertIsSitePm(siteId, userId, activeRole);

    // Block removal if any of these vendors have purchase orders on this site
    const result = await this.dataSource.query(
      `SELECT 1 FROM purchase_orders WHERE "siteId" = $1 AND "vendorId" = ANY($2::uuid[]) AND "deletedAt" IS NULL LIMIT 1`,
      [siteId, vendorIds],
    );
    if (result.length > 0) {
      throw new BadRequestException(SITE_VENDOR_ERRORS.VENDOR_HAS_FINANCIAL_DOCS);
    }

    await this.siteVendorRepository.removeVendors(siteId, vendorIds);
    return { message: SITE_VENDOR_RESPONSES.VENDORS_UNLINKED, removedCount: vendorIds.length };
  }

  /**
   * Assigning and unassigning vendors is reserved for the site's Project Manager.
   *
   * Office roles (SITE_ACCESS_BYPASS_ROLES) pass through via `activeRole`, matching
   * how site-scoped financial documents already behave. `requirePm` applies to every
   * site type, not just Civil.
   */
  private async assertIsSitePm(siteId: string, userId: string, activeRole?: string) {
    const { allowed } = await checkSiteCreateAccess(this.dataSource, userId, siteId, {
      requirePm: true,
      activeRole,
    });
    if (!allowed) {
      throw new ForbiddenException(SITE_VENDOR_ERRORS.NOT_SITE_PM);
    }
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
