export function getUserPermissionsQuery() {
  return `
    SELECT 
      p.name as "permissionName",
      p.id as "permissionId"
    FROM role_permissions rp
    INNER JOIN permissions p ON rp."permissionId" = p.id
    INNER JOIN user_roles ur ON rp."roleId" = ur."roleId"
    WHERE ur."userId" = $1 
      AND rp."deletedAt" IS NULL 
      AND p."deletedAt" IS NULL 
      AND ur."deletedAt" IS NULL
  `;
}
