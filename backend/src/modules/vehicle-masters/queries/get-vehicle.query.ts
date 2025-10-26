import { VehicleQueryDto } from '../dto/vehicle-query.dto';

export const getVehicleQuery = (query: VehicleQueryDto) => {
  const { registrationNo, brand, model, mileage, sortField, sortOrder, page, pageSize } = query;

  const offset = (page - 1) * pageSize;
  const filters: string[] = ['vm.deletedAt IS NULL', 'vv.isActive = true'];
  const params: any[] = [];
  let paramIndex = 1;

  // Add filters
  if (registrationNo) {
    filters.push(`vm.registrationNo ILIKE $${paramIndex}`);
    params.push(`%${registrationNo}%`);
    paramIndex++;
  }

  if (brand) {
    filters.push(`vv.brand ILIKE $${paramIndex}`);
    params.push(`%${brand}%`);
    paramIndex++;
  }

  if (model) {
    filters.push(`vv.model ILIKE $${paramIndex}`);
    params.push(`%${model}%`);
    paramIndex++;
  }

  if (mileage) {
    filters.push(`vv.mileage ILIKE $${paramIndex}`);
    params.push(`%${mileage}%`);
    paramIndex++;
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

  // Map sortField to correct table column
  const sortFieldMap: Record<string, string> = {
    createdAt: 'vm.createdAt',
    updatedAt: 'vm.updatedAt',
    deletedAt: 'vm.deletedAt',
    number: 'vv.number',
    brand: 'vv.brand',
    model: 'vv.model',
    mileage: 'vv.mileage',
  };

  const orderByColumn = sortFieldMap[sortField] || 'vm.createdAt';

  const dataQuery = `
    SELECT 
      vm.id,
      vm.registrationNo,
      vm.createdAt,
      vm.updatedAt,
      vm.deletedAt,
      vv.number,
      vv.brand,
      vv.model,
      vv.mileage,
      vv.additionalData,
      vv.vehicleMasterId
    FROM vehicle_masters vm
    INNER JOIN LATERAL (
      SELECT *
      FROM vehicle_versions
      WHERE vehicleMasterId = vm.id
        AND isActive = true
        AND deletedAt IS NULL
      ORDER BY createdAt DESC
      LIMIT 1
    ) vv ON true
    ${whereClause}
    ORDER BY ${orderByColumn} ${sortOrder}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  const countQuery = `
    SELECT COUNT(DISTINCT vm.id) as total
    FROM vehicle_masters vm
    INNER JOIN LATERAL (
      SELECT 1
      FROM vehicle_versions
      WHERE vehicleMasterId = vm.id
        AND isActive = true
        AND deletedAt IS NULL
      LIMIT 1
    ) vv ON true
    ${whereClause}
  `;

  params.push(pageSize, offset);

  return {
    dataQuery,
    countQuery,
    params,
  };
};
