import { AssetQueryDto } from '../dto/asset-query.dto';

export const getAssetQuery = (query: AssetQueryDto) => {
  const { registrationNo, brand, model, category, sortField, sortOrder, page, pageSize } = query;

  const offset = (page - 1) * pageSize;
  const filters: string[] = ['am.deletedAt IS NULL', 'av.isActive = true'];
  const params: any[] = [];
  let paramIndex = 1;

  // Add filters
  if (registrationNo) {
    filters.push(`am.registrationNo ILIKE $${paramIndex}`);
    params.push(`%${registrationNo}%`);
    paramIndex++;
  }

  if (brand) {
    filters.push(`av.brand ILIKE $${paramIndex}`);
    params.push(`%${brand}%`);
    paramIndex++;
  }

  if (model) {
    filters.push(`av.model ILIKE $${paramIndex}`);
    params.push(`%${model}%`);
    paramIndex++;
  }

  if (category) {
    filters.push(`av.category ILIKE $${paramIndex}`);
    params.push(`%${category}%`);
    paramIndex++;
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

  // Map sortField to correct table column
  const sortFieldMap: Record<string, string> = {
    createdAt: 'am.createdAt',
    updatedAt: 'am.updatedAt',
    deletedAt: 'am.deletedAt',
    number: 'av.number',
    brand: 'av.brand',
    model: 'av.model',
    category: 'av.category',
  };

  const orderByColumn = sortFieldMap[sortField] || 'am.createdAt';

  const dataQuery = `
    SELECT 
      am.id,
      am.registrationNo,
      am.createdAt,
      am.updatedAt,
      am.deletedAt,
      av.number,
      av.brand,
      av.model,
      av.category,
      av.additionalData,
      av.assetMasterId
    FROM asset_masters am
    INNER JOIN LATERAL (
      SELECT *
      FROM asset_versions
      WHERE assetMasterId = am.id
        AND isActive = true
        AND deletedAt IS NULL
      ORDER BY createdAt DESC
      LIMIT 1
    ) av ON true
    ${whereClause}
    ORDER BY ${orderByColumn} ${sortOrder}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  const countQuery = `
    SELECT COUNT(DISTINCT am.id) as total
    FROM asset_masters am
    INNER JOIN LATERAL (
      SELECT 1
      FROM asset_versions
      WHERE assetMasterId = am.id
        AND isActive = true
        AND deletedAt IS NULL
      LIMIT 1
    ) av ON true
    ${whereClause}
  `;

  params.push(pageSize, offset);

  return {
    dataQuery,
    countQuery,
    params,
  };
};
