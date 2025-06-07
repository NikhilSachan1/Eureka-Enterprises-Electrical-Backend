import { PermissionSource } from './constants/user-permission.constants';

export interface UserPermissionResult {
  userId: string;
  permissions: Array<{
    id: string;
    name: string;
    module: string;
    label?: string;
    source: PermissionSource;
    isGranted: boolean;
  }>;
}
