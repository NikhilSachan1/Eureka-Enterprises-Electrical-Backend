import { GetUserPermissionStatsDto } from '../dto';
import { GetUserPermissionsQueryOptions } from '../user-permission.types';

export function getUserPermissionsQuery({
  userId,
  roleId,
  isActive,
}: GetUserPermissionsQueryOptions) {
  const filters: string[] = [
    `ur."userId" = '${userId}'`,
    `rp."deletedAt" IS NULL`,
    `p."deletedAt" IS NULL`,
    `ur."deletedAt" IS NULL`,
  ];

  if (roleId) {
    filters.push(`ur."roleId" = '${roleId}'`);
  }

  if (isActive !== undefined) {
    filters.push(`rp."isActive" = ${isActive}`);
  }

  return `
    SELECT 
      p.name as "permissionName",
      p.module as "permissionModule",
      p.id as "permissionId",
      rp."isActive" as "isGranted",
      r.id as "roleId",
      r.name as "roleName",
      r.label as "roleLabel"
    FROM role_permissions rp
    INNER JOIN permissions p ON rp."permissionId" = p.id
    INNER JOIN user_roles ur ON rp."roleId" = ur."roleId"
    INNER JOIN roles r ON ur."roleId" = r.id AND r."deletedAt" IS NULL
    WHERE ${filters.join(' AND ')}
  `;
}

export function findAllUsersWithPermissionStats(options: GetUserPermissionStatsDto) {
  const { sortField, sortOrder } = options;
  const orderByClause = buildOrderByClause(sortField, sortOrder);

  const usersQuery = `
    WITH user_permission_stats AS (
      SELECT 
        u.id,
        u."firstName",
        u."lastName", 
        u.email,
        u.status,
        u."createdAt",
        u."updatedAt",
        STRING_AGG(DISTINCT r.label, ', ') as role_names,
        COUNT(DISTINCT rp."permissionId") FILTER (WHERE rp."isActive" = true AND rp."deletedAt" IS NULL) as role_permissions_count,
        COUNT(DISTINCT up."permissionId") FILTER (WHERE up."isGranted" = true AND up."deletedAt" IS NULL) as user_permissions_count
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur."userId" AND ur."deletedAt" IS NULL
      LEFT JOIN roles r ON ur."roleId" = r.id AND r."deletedAt" IS NULL
      LEFT JOIN role_permissions rp ON r.id = rp."roleId" AND rp."isActive" = true AND rp."deletedAt" IS NULL
      LEFT JOIN user_permission_overrides up ON u.id = up."userId" AND up."isGranted" = true AND up."deletedAt" IS NULL
      WHERE u."deletedAt" IS NULL
      GROUP BY u.id, u."firstName", u."lastName", u.email, u.status, u."createdAt", u."updatedAt"
    ),
    total_permissions AS (
      SELECT COUNT(*) as total_count
      FROM permissions 
      WHERE "deletedAt" IS NULL
    )
    SELECT 
      ups.*,
      (ups.role_permissions_count + ups.user_permissions_count) as total_permissions,
      tp.total_count as system_total_permissions
    FROM user_permission_stats ups
    CROSS JOIN total_permissions tp
    ${orderByClause}
    LIMIT $1 OFFSET $2;
  `;

  const countQuery = `
      SELECT COUNT(*) as total_users
      FROM users u
      WHERE u."deletedAt" IS NULL
    `;

  return {
    usersQuery,
    countQuery,
  };
}

function buildOrderByClause(sortField?: string, sortOrder?: string): string {
  if (sortField === 'total_permissions') {
    return `ORDER BY (ups.role_permissions_count + ups.user_permissions_count) ${sortOrder}`;
  }

  return `ORDER BY ups."${sortField}" ${sortOrder}`;
}
