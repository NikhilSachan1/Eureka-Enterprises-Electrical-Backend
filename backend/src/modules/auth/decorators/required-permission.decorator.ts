import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Mark a route handler as requiring one or more permission keys.
 *
 * The PermissionsGuard reads this metadata and verifies that the authenticated
 * user has every listed permission via either a role-permission grant or a
 * user-permission override.
 *
 * Usage:
 *   @RequiredPermission('financials.purchase-orders.approve')
 *   @Post(':id/approve')
 *   async approve() { ... }
 *
 *   @RequiredPermission('financials.gst.verify', 'financials.gst.release-payment')
 *   ...
 *
 * Multiple permissions are AND'd — caller must have ALL of them.
 */
export const RequiredPermission = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const ANY_PERMISSIONS_KEY = 'anyPermissions';

/**
 * Mark a route handler as needing AT LEAST ONE of the listed permission keys.
 *
 * For an API shared by several screens: list the permission that opens each screen, so
 * whoever can use any of those screens can call it, and switching all of them off blocks it.
 *
 * Keys missing from the permissions table are ignored; if none of them is registered the
 * route is refused (fails closed). An explicit per-user deny of a key means that key does not
 * count. Can be combined with @RequiredPermission (then both must pass).
 *
 * Usage:
 *   @RequiredAnyPermission('project.view-detail', 'project.edit')
 *   @Get(':id')
 *   async findOne() { ... }
 */
export const RequiredAnyPermission = (...permissions: string[]) =>
  SetMetadata(ANY_PERMISSIONS_KEY, permissions);
