import { DataSource, EntityManager } from 'typeorm';
import { Roles } from 'src/modules/roles/constants/role.constants';

/** Site-role value that marks a user as the site's Project Manager (site_allocations.role). */
export const PROJECT_MANAGER_SITE_ROLE = 'Project Manager';

/**
 * Office roles that can create financial docs for any site without a current
 * site_allocation — mirrors site listing ADMIN_ROLES in SiteService.
 */
export const SITE_ACCESS_BYPASS_ROLES: readonly string[] = [
  Roles.SUPER_ADMIN,
  Roles.ADMIN,
  Roles.MANAGER,
  Roles.OPERATION_MANAGER,
  Roles.HR,
];

export interface SiteAccessResult {
  allowed: boolean;
  reason: string | null;
}

export const SITE_ACCESS_REASONS = {
  SITE_NOT_FOUND: 'Site not found',
  NOT_ALLOCATED: 'You are not allocated to this site.',
  CIVIL_PM_ONLY: 'Civil site: only the site Project Manager can create this document.',
  CIVIL_SITE_ONLY: 'A Purchase Order can only be created for a Civil site.',
};

/**
 * Site-scoped create authorization used across financial docs (PO / JMC / Invoice).
 *
 * Base rule: the user must have a **current** allocation to the site (site_allocations,
 * isCurrentlyAllocated = true). "Assigned to this site."
 *
 * Office roles (SUPER_ADMIN / ADMIN / MANAGER / OPERATION_MANAGER / HR) bypass allocation
 * via `opts.activeRole` — they can create for any site (same as site listing access).
 *
 * `civilOnly` (PO only): a PO can only be created for a site whose `siteTypes` includes
 * 'Civil'. This is a document-level constraint on the site (not the user), so it is enforced
 * before the office-role bypass — Electrical-only sites reject a PO for everyone.
 *
 * `requirePmForCivil` (PO only): if the site's `siteTypes` includes 'Civil', the user's
 * allocation role must be Project Manager. JMC / Invoice pass this false → any allocated user.
 */
export async function checkSiteCreateAccess(
  db: DataSource | EntityManager,
  userId: string,
  siteId: string,
  opts: { requirePmForCivil?: boolean; civilOnly?: boolean; activeRole?: string } = {},
): Promise<SiteAccessResult> {
  const [site] = await db.query(
    `SELECT "siteTypes" FROM sites WHERE id = $1 AND "deletedAt" IS NULL`,
    [siteId],
  );
  if (!site) return { allowed: false, reason: SITE_ACCESS_REASONS.SITE_NOT_FOUND };

  const types = (site.siteTypes ?? []).map((t: string) => String(t).toUpperCase());

  // Document-level site gate (PO): a PO belongs to Civil sites only. Applies to everyone,
  // including office roles — an Electrical-only site has no PO concept.
  if (opts.civilOnly && !types.includes('CIVIL')) {
    return { allowed: false, reason: SITE_ACCESS_REASONS.CIVIL_SITE_ONLY };
  }

  if (opts.activeRole && SITE_ACCESS_BYPASS_ROLES.includes(opts.activeRole.toUpperCase())) {
    return { allowed: true, reason: null };
  }

  const [alloc] = await db.query(
    `SELECT role FROM site_allocations
     WHERE "userId" = $1 AND "siteId" = $2 AND "isCurrentlyAllocated" = true AND "deletedAt" IS NULL
     LIMIT 1`,
    [userId, siteId],
  );
  if (!alloc) return { allowed: false, reason: SITE_ACCESS_REASONS.NOT_ALLOCATED };

  if (opts.requirePmForCivil) {
    if (types.includes('CIVIL') && String(alloc.role) !== PROJECT_MANAGER_SITE_ROLE) {
      return { allowed: false, reason: SITE_ACCESS_REASONS.CIVIL_PM_ONLY };
    }
  }
  return { allowed: true, reason: null };
}
