import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource, In, IsNull } from 'typeorm';
import {
  checkSiteCreateAccess,
  PROJECT_MANAGER_SITE_ROLE,
  SITE_ACCESS_BYPASS_ROLES,
} from 'src/modules/common/financials/site-access.helper';
import { SiteVendorRepository } from './site-vendor.repository';
import { VendorRepository } from 'src/modules/vendors/vendor.repository';
import { SiteRepository } from 'src/modules/sites/site.repository';
import { VENDOR_ERRORS } from 'src/modules/vendors/constants/vendor.constants';
import { SITE_ERRORS, SiteStatus } from 'src/modules/sites/constants/site.constants';
import { SITE_VENDOR_ERRORS, SITE_VENDOR_RESPONSES } from './constants/site-vendor.constants';

@Injectable()
export class SiteVendorService {
  constructor(
    private readonly siteVendorRepository: SiteVendorRepository,
    private readonly vendorRepository: VendorRepository,
    private readonly siteRepository: SiteRepository,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * The sites this user may assign vendors to — drives the FE vendor section's visibility and its
   * site picker in one call.
   *
   * Deliberately returns only the user's **Project Manager** sites, not every site he is allocated
   * to: a site where he is an Engineer would 403 on assign, so offering it in the picker would be
   * a trap. Bypass roles get every site, matching how the assign/unassign enforcement treats them.
   *
   * `allowed` is separate from `sites.length > 0` for one case: an admin on a system with no sites
   * yet is still allowed, and the section should render with an empty picker.
   */
  async getAssignableSites(
    userId: string,
    activeRole?: string,
  ): Promise<{ allowed: boolean; sites: Array<{ id: string; name: string }> }> {
    if (activeRole && SITE_ACCESS_BYPASS_ROLES.includes(activeRole.toUpperCase())) {
      const sites = await this.dataSource.query(
        `SELECT id, name FROM sites
          WHERE "deletedAt" IS NULL AND status <> $1
          ORDER BY name`,
        [SiteStatus.COMPLETED],
      );
      return { allowed: true, sites };
    }

    // DISTINCT because a user can hold more than one allocation row on the same site.
    //
    // The status filter is not redundant with isCurrentlyAllocated: site.service blocks the
    // *transition* to completed while allocations are current, but nothing clears allocations
    // afterwards, so completed sites with live allocations do exist.
    const sites = await this.dataSource.query(
      `SELECT DISTINCT s.id, s.name
         FROM site_allocations sa
         INNER JOIN sites s ON s.id = sa."siteId" AND s."deletedAt" IS NULL
        WHERE sa."userId" = $1
          AND sa.role = $2
          AND sa."isCurrentlyAllocated" = true
          AND sa."deletedAt" IS NULL
          AND s.status <> $3
        ORDER BY s.name`,
      [userId, PROJECT_MANAGER_SITE_ROLE, SiteStatus.COMPLETED],
    );

    return { allowed: sites.length > 0, sites };
  }

  async listVendorsForSite(siteId: string) {
    await this.assertSiteExists(siteId);
    const rows = await this.siteVendorRepository.getVendorsBySiteId(siteId);
    return rows.filter((r) => r.vendor && !r.vendor.deletedAt).map((r) => r.vendor);
  }

  async addVendorsToSite(siteId: string, vendorIds: string[], userId: string, activeRole?: string) {
    await this.assertSiteExists(siteId);
    await this.assertSiteNotCompleted(siteId);
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
   * A completed site accepts no new vendors.
   *
   * Applies to everyone, including the office roles that bypass the PM check — otherwise an admin
   * could still assign to a closed site through a direct call while the FE picker hides it, and
   * the gating and the enforcement would disagree.
   *
   * Only `completed` is blocked; `hold` and `work_completed` stay assignable by decision. Removal
   * is deliberately NOT blocked — a vendor wrongly attached to a closed site must remain
   * removable, otherwise the bad data is stranded.
   */
  private async assertSiteNotCompleted(siteId: string) {
    const [site] = await this.dataSource.query(
      `SELECT status FROM sites WHERE id = $1 AND "deletedAt" IS NULL`,
      [siteId],
    );
    if (site?.status === SiteStatus.COMPLETED) {
      throw new ForbiddenException(SITE_VENDOR_ERRORS.SITE_COMPLETED);
    }
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
