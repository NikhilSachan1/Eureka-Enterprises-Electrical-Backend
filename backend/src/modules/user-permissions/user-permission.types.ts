import { PermissionSource } from './constants/user-permission.constants';

export interface UserPermissionResult {
  userId: string;
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
    }>;
  }>;
}

export interface GetUserPermissionsQueryOptions {
  userId: string;
  roleId?: string;
  isActive?: boolean;
}
