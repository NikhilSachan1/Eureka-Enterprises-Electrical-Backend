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
  const { sortField, sortOrder, roles, search, userIds } = options;
  const orderByClause = buildOrderByClause(sortField, sortOrder);

  // Build dynamic WHERE clause for user filters
  // Exclude SYSTEM users from the results
  const userFilters: string[] = ['u."deletedAt" IS NULL', `u.status != 'SYSTEM'`];

  // Multi-select user IDs filter
  if (userIds && userIds.length > 0) {
    const userIdList = userIds.map((id) => `'${id}'`).join(', ');
    userFilters.push(`u.id IN (${userIdList})`);
  }

  // Build HAVING clause for role filter (supports multiple role names/codes)
  let havingClause = '';
  if (roles && roles.length > 0) {
    const roleNames = roles.map((r) => `'${r.replace(/'/g, "''")}'`).join(', ');
    havingClause = `HAVING bool_or(r.name IN (${roleNames}))`;
  }

  // Build search condition (search by first name, last name, or email)
  if (search) {
    const searchTerm = search.replace(/'/g, "''"); // Escape single quotes
    userFilters.push(`(
      u."firstName" ILIKE '%${searchTerm}%' OR 
      u."lastName" ILIKE '%${searchTerm}%' OR 
      u.email ILIKE '%${searchTerm}%'
    )`);
  }

  const whereClause = userFilters.join(' AND ');

  const usersQuery = `
    WITH user_permission_stats AS (
      SELECT 
        u.id,
        u."employeeId",
        u."firstName",
        u."lastName", 
        u.email,
        u.status,
        u."createdAt",
        u."updatedAt",
        ARRAY_AGG(DISTINCT r.label) FILTER (WHERE r.label IS NOT NULL) as role_labels,
        ARRAY_AGG(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL) as role_names,
        COUNT(DISTINCT rp."permissionId") FILTER (WHERE rp."isActive" = true AND rp."deletedAt" IS NULL) as role_permissions_count,
        COUNT(DISTINCT up."permissionId") FILTER (WHERE up."isGranted" = true AND up."deletedAt" IS NULL) as user_permissions_granted_count,
        COUNT(DISTINCT up."permissionId") FILTER (WHERE up."isGranted" = false AND up."deletedAt" IS NULL) as user_permissions_revoked_count
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur."userId" AND ur."deletedAt" IS NULL
      LEFT JOIN roles r ON ur."roleId" = r.id AND r."deletedAt" IS NULL
      LEFT JOIN role_permissions rp ON r.id = rp."roleId" AND rp."isActive" = true AND rp."deletedAt" IS NULL
      LEFT JOIN user_permission_overrides up ON u.id = up."userId" AND up."deletedAt" IS NULL
      WHERE ${whereClause}
      GROUP BY u.id, u."employeeId", u."firstName", u."lastName", u.email, u.status, u."createdAt", u."updatedAt"
      ${havingClause}
    ),
    total_permissions AS (
      SELECT COUNT(*) as total_count
      FROM permissions 
      WHERE "deletedAt" IS NULL
    )
    SELECT 
      ups.*,
      GREATEST(0, ups.role_permissions_count + ups.user_permissions_granted_count - ups.user_permissions_revoked_count) as effective_permissions_count,
      tp.total_count as system_total_permissions
    FROM user_permission_stats ups
    CROSS JOIN total_permissions tp
    ${orderByClause}
    LIMIT $1 OFFSET $2;
  `;

  // Count query also needs the same filters (exclude SYSTEM users)
  const countFilters: string[] = ['u."deletedAt" IS NULL', `u.status != 'SYSTEM'`];
  if (userIds && userIds.length > 0) {
    const userIdList = userIds.map((id) => `'${id}'`).join(', ');
    countFilters.push(`u.id IN (${userIdList})`);
  }
  if (search) {
    const searchTerm = search.replace(/'/g, "''");
    countFilters.push(`(
      u."firstName" ILIKE '%${searchTerm}%' OR 
      u."lastName" ILIKE '%${searchTerm}%' OR 
      u.email ILIKE '%${searchTerm}%'
    )`);
  }

  // For role filter in count, we need a subquery
  let countQuery = `
    SELECT COUNT(*) as total_users
    FROM users u
    WHERE ${countFilters.join(' AND ')}
  `;

  if (roles && roles.length > 0) {
    const roleNames = roles.map((r) => `'${r.replace(/'/g, "''")}'`).join(', ');
    countQuery = `
      SELECT COUNT(DISTINCT u.id) as total_users
      FROM users u
      INNER JOIN user_roles ur ON u.id = ur."userId" AND ur."deletedAt" IS NULL
      INNER JOIN roles r ON ur."roleId" = r.id AND r."deletedAt" IS NULL
      WHERE ${countFilters.join(' AND ')} AND r.name IN (${roleNames})
    `;
  }

  return {
    usersQuery,
    countQuery,
  };
}

function buildOrderByClause(sortField?: string, sortOrder?: string): string {
  if (sortField === 'effective_permissions_count') {
    return `ORDER BY GREATEST(0, ups.role_permissions_count + ups.user_permissions_granted_count - ups.user_permissions_revoked_count) ${sortOrder}`;
  }

  return `ORDER BY ups."${sortField}" ${sortOrder}`;
}
