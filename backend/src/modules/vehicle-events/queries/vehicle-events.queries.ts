import { VehicleEventTypes } from 'src/modules/vehicle-masters/constants/vehicle-masters.constants';
import { getUserJsonBuildObject } from 'src/utils/master-constants/master-constants';
import { SortOrder } from 'src/utils/utility/constants/utility.constants';
import {
  VehicleEventsSortableFields,
  VEHICLE_EVENTS_SORT_FIELD_MAPPING,
} from '../constants/vehicle-events.constants';
import { VehicleEventsQueryDto } from '../dto/vehicle-events-query.dto';

export interface BuildVehicleEventsQueryParams {
  vehicleMasterId: string;
  query: VehicleEventsQueryDto;
  startDateUTC?: Date;
  endDateUTC?: Date;
}

export const buildVehicleEventsStatsQuery = (vehicleMasterId: string) => {
  const query = `
    SELECT 
      COUNT(*) as "total",
      ${Object.values(VehicleEventTypes)
        .map(
          (eventType) =>
            `COUNT(CASE WHEN "eventType" = '${eventType}' THEN 1 END) as "${eventType}"`,
        )
        .join(',\n      ')}
    FROM "vehicles_events"
    WHERE "vehicleMasterId" = $1
  `;

  return { query, params: [vehicleMasterId] };
};

export const buildVehicleEventsQuery = ({
  vehicleMasterId,
  query,
  startDateUTC,
  endDateUTC,
}: BuildVehicleEventsQueryParams) => {
  const {
    eventType,
    toUser,
    fromUser,
    createdBy,
    sortField = VehicleEventsSortableFields.CREATED_AT,
    sortOrder = SortOrder.DESC,
    page = 1,
    pageSize = 10,
  } = query;

  const filters: string[] = ['ve."vehicleMasterId" = $1'];
  const params: any[] = [vehicleMasterId];
  let paramIndex = 2;

  // Date range filters
  if (startDateUTC && endDateUTC) {
    filters.push(`ve."createdAt" >= $${paramIndex} AND ve."createdAt" <= $${paramIndex + 1}`);
    params.push(startDateUTC, endDateUTC);
    paramIndex += 2;
  } else if (startDateUTC) {
    filters.push(`ve."createdAt" >= $${paramIndex}`);
    params.push(startDateUTC);
    paramIndex++;
  } else if (endDateUTC) {
    filters.push(`ve."createdAt" <= $${paramIndex}`);
    params.push(endDateUTC);
    paramIndex++;
  }

  // Event type filter
  if (eventType) {
    filters.push(`ve."eventType" = $${paramIndex}`);
    params.push(eventType);
    paramIndex++;
  }

  // User filters
  if (toUser) {
    filters.push(`ve."toUser" = $${paramIndex}`);
    params.push(toUser);
    paramIndex++;
  }

  if (fromUser) {
    filters.push(`ve."fromUser" = $${paramIndex}`);
    params.push(fromUser);
    paramIndex++;
  }

  if (createdBy) {
    filters.push(`ve."createdBy" = $${paramIndex}`);
    params.push(createdBy);
    paramIndex++;
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
  const orderByColumn = VEHICLE_EVENTS_SORT_FIELD_MAPPING[sortField] || 've."createdAt"';
  const offset = (page - 1) * pageSize;

  const dataQuery = `
    SELECT 
      ve."id",
      ve."vehicleMasterId",
      ve."eventType",
      ve."fromUser" as "fromUserId",
      ve."toUser" as "toUserId",
      ve."metadata",
      ve."createdAt",
      ve."updatedAt",
      ve."createdBy" as "createdById",
      
      -- Vehicle details
      json_build_object(
        'id', vm."id",
        'registrationNo', vv."registrationNo",
        'brand', vv."brand",
        'model', vv."model",
        'status', vv."status"
      ) as "vehicle",
      
      -- Created by user
      CASE WHEN cb."id" IS NOT NULL THEN ${getUserJsonBuildObject(
        'cb',
      )} ELSE NULL END as "createdByUser",
      
      -- From user details
      CASE WHEN fu."id" IS NOT NULL THEN ${getUserJsonBuildObject(
        'fu',
      )} ELSE NULL END as "fromUserDetails",
      
      -- To user details
      CASE WHEN tu."id" IS NOT NULL THEN ${getUserJsonBuildObject(
        'tu',
      )} ELSE NULL END as "toUserDetails",
      
      -- Vehicle files
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'id', vf."id",
              'fileKey', vf."fileKey",
              'fileType', vf."fileType",
              'label', vf."label"
            )
          )
          FROM "vehicles_files" vf
          WHERE vf."vehicleEventsId" = ve."id" AND vf."deletedAt" IS NULL
        ),
        '[]'
      ) as "vehicleFiles"
      
    FROM "vehicles_events" ve
    LEFT JOIN "vehicle_masters" vm ON ve."vehicleMasterId" = vm."id"
    LEFT JOIN LATERAL (
      SELECT *
      FROM "vehicle_versions"
      WHERE "vehicleMasterId" = vm."id"
        AND "isActive" = true
        AND "deletedAt" IS NULL
      LIMIT 1
    ) vv ON true
    LEFT JOIN "users" cb ON ve."createdBy" = cb."id"
    LEFT JOIN "users" fu ON ve."fromUser" = fu."id"
    LEFT JOIN "users" tu ON ve."toUser" = tu."id"
    ${whereClause}
    ORDER BY ${orderByColumn} ${sortOrder}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  const countQuery = `
    SELECT COUNT(*) as total
    FROM "vehicles_events" ve
    ${whereClause}
  `;

  const countParams = [...params];
  params.push(pageSize, offset);

  return {
    dataQuery,
    countQuery,
    params,
    countParams,
  };
};
