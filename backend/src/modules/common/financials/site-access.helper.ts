import { DataSource, EntityManager } from 'typeorm';

/** Site-role value that marks a user as the site's Project Manager (site_allocations.role). */
export const PROJECT_MANAGER_SITE_ROLE = 'Project Manager';

export interface SiteAccessResult {
  allowed: boolean;
  reason: string | null;
}

export const SITE_ACCESS_REASONS = {
  SITE_NOT_FOUND: 'Site not found',
  NOT_ALLOCATED: 'You are not allocated to this site.',
  CIVIL_PM_ONLY: 'Civil site: only the site Project Manager can create this document.',
};

/**
 * Site-scoped create authorization used across financial docs (PO / JMC / Invoice).
 *
 * Base rule: the user must have a **current** allocation to the site (site_allocations,
 * isCurrentlyAllocated = true). "Assigned to this site."
 *
 * `requirePmForCivil` (PO only): if the site's `siteTypes` includes 'Civil', the user's
 * allocation role must be Project Manager. Electrical-only sites → any allocated user.
 * JMC / Invoice pass this false → any allocated user (team + PM).
 */
export async function checkSiteCreateAccess(
  db: DataSource | EntityManager,
  userId: string,
  siteId: string,
  opts: { requirePmForCivil?: boolean } = {},
): Promise<SiteAccessResult> {
  const [site] = await db.query(
    `SELECT "siteTypes" FROM sites WHERE id = $1 AND "deletedAt" IS NULL`,
    [siteId],
  );
  if (!site) return { allowed: false, reason: SITE_ACCESS_REASONS.SITE_NOT_FOUND };

  const [alloc] = await db.query(
    `SELECT role FROM site_allocations
     WHERE "userId" = $1 AND "siteId" = $2 AND "isCurrentlyAllocated" = true AND "deletedAt" IS NULL
     LIMIT 1`,
    [userId, siteId],
  );
  if (!alloc) return { allowed: false, reason: SITE_ACCESS_REASONS.NOT_ALLOCATED };

  if (opts.requirePmForCivil) {
    const types = (site.siteTypes ?? []).map((t: string) => String(t).toUpperCase());
    if (types.includes('CIVIL') && String(alloc.role) !== PROJECT_MANAGER_SITE_ROLE) {
      return { allowed: false, reason: SITE_ACCESS_REASONS.CIVIL_PM_ONLY };
    }
  }
  return { allowed: true, reason: null };
}
