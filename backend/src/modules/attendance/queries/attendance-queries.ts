import { AttendanceQueryDto } from '../dto/attendance-query.dto';
import { ATTENDANCE_SORTABLE_FIELDS } from '../constants/attendance.constants';

export function buildAttendanceListQuery(query: AttendanceQueryDto) {
  const {
    page,
    pageSize,
    sortField,
    sortOrder,
    userIds,
    startDate,
    endDate,
    date,
    statuses,
    approvalStatuses,
    search,
  } = query;

  const whereConditions = [];
  const params: any[] = [];
  let paramIndex = 1;

  // Base condition
  whereConditions.push(`a."isActive" = $${paramIndex}`);
  params.push(true);
  paramIndex++;

  // Date filters
  if (date) {
    whereConditions.push(`DATE(a."attendanceDate") = $${paramIndex}`);
    params.push(date);
    paramIndex++;
  } else {
    if (startDate) {
      whereConditions.push(`a."attendanceDate" >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }
    if (endDate) {
      whereConditions.push(`a."attendanceDate" <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }
  }

  // User IDs filter
  if (userIds && userIds.length > 0) {
    whereConditions.push(`a."userId" = ANY($${paramIndex})`);
    params.push(userIds);
    paramIndex++;
  }

  // Status filters
  if (statuses && statuses.length > 0) {
    whereConditions.push(`a."status" = ANY($${paramIndex})`);
    params.push(statuses);
    paramIndex++;
  }

  // Approval status filters
  if (approvalStatuses && approvalStatuses.length > 0) {
    whereConditions.push(`a."approvalStatus" = ANY($${paramIndex})`);
    params.push(approvalStatuses);
    paramIndex++;
  }

  // Search filter
  if (search) {
    whereConditions.push(`(
      u."firstName" ILIKE $${paramIndex} OR 
      u."lastName" ILIKE $${paramIndex} OR 
      u."email" ILIKE $${paramIndex} OR 
      u."id" ILIKE $${paramIndex}
    )`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  const whereClause = whereConditions.join(' AND ');

  const orderByField = ATTENDANCE_SORTABLE_FIELDS[sortField] || 'a."attendanceDate"';
  const offset = (page - 1) * pageSize;

  // Main query
  const mainQuery = `
    SELECT 
      a."id" as "attendanceId",
      a."userId",
      a."attendanceDate",
      a."checkInTime",
      a."checkOutTime",
      a."status",
      a."shiftConfigId",
      a."entrySourceType",
      a."attendanceType",
      a."regularizedBy",
      a."approvalStatus",
      a."approvalBy",
      a."approvalAt",
      a."approvalComment",
      a."notes",
      a."createdAt",
      a."updatedAt",
      a."createdBy",
      u."firstName",
      u."lastName",
      u."email",
      cb."firstName" as "createdByFirstName",
      cb."lastName" as "createdByLastName",
      cb."email" as "createdByEmail",
      ab."firstName" as "approvalByFirstName",
      ab."lastName" as "approvalByLastName",
      ab."email" as "approvalByEmail"
    FROM "attendances" a
    LEFT JOIN "users" u ON a."userId" = u."id"
    LEFT JOIN "users" cb ON a."createdBy" = cb."id"
    LEFT JOIN "users" ab ON a."approvalBy" = ab."id"
    WHERE ${whereClause}
    ORDER BY ${orderByField} ${sortOrder}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  // Count query
  const countQuery = `
    SELECT COUNT(*) as total
    FROM "attendances" a
    LEFT JOIN "users" u ON a."userId" = u."id"
    WHERE ${whereClause}
  `;

  // Add pagination params only for main query
  const mainQueryParams = [...params, pageSize, offset];

  return {
    query: mainQuery,
    countQuery,
    params: mainQueryParams,
    countParams: params, // Separate params for count query without pagination
  };
}

export function buildAttendanceStatsQuery(query: AttendanceQueryDto) {
  const { userIds, startDate, endDate, date, statuses, approvalStatuses, search } = query;

  const whereConditions = [];
  const params: any[] = [];
  let paramIndex = 1;

  // Base condition
  whereConditions.push(`a."isActive" = $${paramIndex}`);
  params.push(true);
  paramIndex++;

  // Apply same filters as main query
  if (date) {
    whereConditions.push(`DATE(a."attendanceDate") = $${paramIndex}`);
    params.push(date);
    paramIndex++;
  } else {
    if (startDate) {
      whereConditions.push(`a."attendanceDate" >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }
    if (endDate) {
      whereConditions.push(`a."attendanceDate" <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }
  }

  if (userIds && userIds.length > 0) {
    whereConditions.push(`a."userId" = ANY($${paramIndex})`);
    params.push(userIds);
    paramIndex++;
  }

  if (statuses && statuses.length > 0) {
    whereConditions.push(`a."status" = ANY($${paramIndex})`);
    params.push(statuses);
    paramIndex++;
  }

  if (approvalStatuses && approvalStatuses.length > 0) {
    whereConditions.push(`a."approvalStatus" = ANY($${paramIndex})`);
    params.push(approvalStatuses);
    paramIndex++;
  }

  if (search) {
    whereConditions.push(`(
      u."firstName" ILIKE $${paramIndex} OR 
      u."lastName" ILIKE $${paramIndex} OR 
      u."email" ILIKE $${paramIndex} OR 
      u."id" ILIKE $${paramIndex}
    )`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  const whereClause = whereConditions.join(' AND ');

  const statsQuery = `
    SELECT
      a."status",
      a."approvalStatus",
      COUNT(*) as count
    FROM "attendances" a
    LEFT JOIN "users" u ON a."userId" = u."id"
    WHERE ${whereClause}
    GROUP BY a."status", a."approvalStatus"
  `;

  return {
    query: statsQuery,
    params,
  };
}
