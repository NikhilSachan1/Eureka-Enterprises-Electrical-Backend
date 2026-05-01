import { GetOrgFilesDto } from '../dto';
import { ORG_FILE_SORT_FIELD_MAPPING } from '../constants/org-files.constants';

export const buildListOrgFilesQuery = (filters: GetOrgFilesDto) => {
  const { parentId, page, pageSize, sortField, sortOrder } = filters;

  const params: any[] = [];
  let paramIndex = 1;

  const whereConditions: string[] = [`n."deletedAt" IS NULL`];

  if (parentId) {
    whereConditions.push(`n."parentId" = $${paramIndex}`);
    params.push(parentId);
    paramIndex++;
  } else {
    whereConditions.push(`n."parentId" IS NULL`);
  }

  const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
  const orderColumn = ORG_FILE_SORT_FIELD_MAPPING[sortField] || 'n."type" DESC, n."name"';
  const orderDir = sortOrder || 'ASC';
  const offset = ((page || 1) - 1) * (pageSize || 10);

  const query = `
    SELECT
      n."id",
      n."name",
      n."type",
      n."parentId",
      n."storageKey",
      n."mimeType",
      n."size",
      n."createdBy",
      n."createdAt",
      n."updatedAt"
    FROM "org_file_nodes" n
    ${whereClause}
    ORDER BY ${orderColumn} ${orderDir}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  params.push(pageSize || 10, offset);

  const countQuery = `
    SELECT COUNT(*) as total
    FROM "org_file_nodes" n
    ${whereClause}
  `;
  const countParams = params.slice(0, paramIndex - 1);

  return { query, countQuery, params, countParams };
};

export const buildBreadcrumbQuery = (nodeId: string) => {
  const query = `
    WITH RECURSIVE breadcrumb AS (
      SELECT
        n."id",
        n."name",
        n."type",
        n."parentId",
        0 AS depth
      FROM "org_file_nodes" n
      WHERE n."id" = $1 AND n."deletedAt" IS NULL

      UNION ALL

      SELECT
        p."id",
        p."name",
        p."type",
        p."parentId",
        b.depth + 1
      FROM "org_file_nodes" p
      INNER JOIN breadcrumb b ON b."parentId" = p."id"
      WHERE p."deletedAt" IS NULL
    )
    SELECT "id", "name", "type", "parentId"
    FROM breadcrumb
    ORDER BY depth DESC
  `;

  return { query, params: [nodeId] };
};

export const buildDescendantIdsQuery = (folderId: string) => {
  const query = `
    WITH RECURSIVE descendants AS (
      SELECT "id", "type", "storageKey"
      FROM "org_file_nodes"
      WHERE "parentId" = $1 AND "deletedAt" IS NULL

      UNION ALL

      SELECT n."id", n."type", n."storageKey"
      FROM "org_file_nodes" n
      INNER JOIN descendants d ON n."parentId" = d."id"
      WHERE n."deletedAt" IS NULL
    )
    SELECT "id", "type", "storageKey" FROM descendants
  `;

  return { query, params: [folderId] };
};

export const buildDescendantFolderIdsQuery = (folderId: string) => {
  const query = `
    WITH RECURSIVE descendants AS (
      SELECT "id"
      FROM "org_file_nodes"
      WHERE "id" = $1 AND "deletedAt" IS NULL

      UNION ALL

      SELECT n."id"
      FROM "org_file_nodes" n
      INNER JOIN descendants d ON n."parentId" = d."id"
      WHERE n."deletedAt" IS NULL
    )
    SELECT "id" FROM descendants
  `;

  return { query, params: [folderId] };
};
