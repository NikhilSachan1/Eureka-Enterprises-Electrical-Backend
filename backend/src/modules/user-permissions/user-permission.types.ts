import { PermissionSource } from './constants/user-permission.constants';
import { PermissionPlatform } from '../permissions/constants/permission.constants';

export interface UserPermissionResult {
  userId: string;
  platform?: PermissionPlatform;
  role?: {
    id: string;
    name: string;
    label: string;
  };
  permissions: Array<{
    module: string;
    permissions: Array<{
      id: string;
      name: string;
      label?: string;
      source: PermissionSource;
      isGranted: boolean;
      platform?: PermissionPlatform;
    }>;
  }>;
}

export interface GetUserPermissionsQueryOptions {
  userId: string;
  roleId?: string;
  isActive?: boolean;
  platform?: PermissionPlatform;
}
