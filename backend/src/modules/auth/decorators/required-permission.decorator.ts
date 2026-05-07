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
