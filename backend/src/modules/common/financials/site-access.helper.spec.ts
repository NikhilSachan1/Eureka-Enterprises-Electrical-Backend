import { ForbiddenException } from '@nestjs/common';
import {
  assertCanReadSite,
  getReadableSiteIds,
  resolveReadableSiteFilter,
} from './site-access.helper';

/** A fake DataSource whose only query returns the user's allocated sites. */
const dbWithAllocations = (siteIds: string[]) =>
  ({
    query: jest.fn(async () => siteIds.map((siteId) => ({ siteId }))),
  } as never);

describe('site access for reading financial documents', () => {
  it.each(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OPERATION_MANAGER', 'HR', 'ACCOUNTS', 'accounts'])(
    '%s reads every site',
    async (role) => {
      await expect(getReadableSiteIds(dbWithAllocations([]), 'u1', role)).resolves.toBeNull();
    },
  );

  it('an employee reads only the sites they were allocated to', async () => {
    await expect(
      getReadableSiteIds(dbWithAllocations(['site-a']), 'u1', 'EMPLOYEE'),
    ).resolves.toEqual(['site-a']);
  });

  describe('resolveReadableSiteFilter (list filters)', () => {
    it('office roles: no filter, or just the requested site', async () => {
      const db = dbWithAllocations([]);
      await expect(resolveReadableSiteFilter(db, 'u1', 'ACCOUNTS')).resolves.toBeNull();
      await expect(resolveReadableSiteFilter(db, 'u1', 'ACCOUNTS', ['site-b'])).resolves.toEqual([
        'site-b',
      ]);
    });

    it('employee: own sites, and an empty list for someone else’s site', async () => {
      const db = dbWithAllocations(['site-a']);
      await expect(resolveReadableSiteFilter(db, 'u1', 'EMPLOYEE')).resolves.toEqual(['site-a']);
      await expect(resolveReadableSiteFilter(db, 'u1', 'EMPLOYEE', ['site-b'])).resolves.toEqual(
        [],
      );
    });
  });

  describe('assertCanReadSite (one-site APIs)', () => {
    it('lets office roles through for any site', async () => {
      await expect(
        assertCanReadSite(dbWithAllocations([]), 'u1', 'ACCOUNTS', 'site-b'),
      ).resolves.toBeUndefined();
    });

    it('lets an employee through for their own site', async () => {
      await expect(
        assertCanReadSite(dbWithAllocations(['site-a']), 'u1', 'EMPLOYEE', 'site-a'),
      ).resolves.toBeUndefined();
    });

    it('refuses an employee for someone else’s site', async () => {
      await expect(
        assertCanReadSite(dbWithAllocations(['site-a']), 'u1', 'EMPLOYEE', 'site-b'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
