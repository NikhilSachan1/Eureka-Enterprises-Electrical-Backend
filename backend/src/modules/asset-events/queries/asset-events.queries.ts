import {
  AssetEventsSortableFields,
  ASSET_EVENTS_SORT_FIELD_MAPPING,
} from '../constants/asset-events.constants';
import { getUserJsonBuildObject } from 'src/utils/master-constants/master-constants';
import { SortOrder } from 'src/utils/utility/constants/utility.constants';
import { BuildAssetEventsQueryParams } from './asset-events.queries.types';

export const buildAssetEventsQuery = ({
  assetMasterId,
  query,
  startDateUTC,
  endDateUTC,
}: BuildAssetEventsQueryParams) => {
  const {
    eventTypes,
    toUser,
    fromUser,
    createdBy,
    sortField = AssetEventsSortableFields.CREATED_AT,
    sortOrder = SortOrder.DESC,
    page,
    pageSize,
  } = query;

  const filters: string[] = ['ae."assetMasterId" = $1'];
  const params: any[] = [assetMasterId];
  let paramIndex = 2;

  // Date range filters
  if (startDateUTC && endDateUTC) {
    filters.push(`ae."createdAt" >= $${paramIndex} AND ae."createdAt" <= $${paramIndex + 1}`);
    params.push(startDateUTC, endDateUTC);
    paramIndex += 2;
  } else if (startDateUTC) {
    filters.push(`ae."createdAt" >= $${paramIndex}`);
    params.push(startDateUTC);
    paramIndex++;
  } else if (endDateUTC) {
    filters.push(`ae."createdAt" <= $${paramIndex}`);
    params.push(endDateUTC);
    paramIndex++;
  }

  // Event types filter
  if (eventTypes?.length > 0) {
    filters.push(`ae."eventType" = ANY($${paramIndex})`);
    params.push(eventTypes);
    paramIndex++;
  }

  // User filters
  if (toUser) {
    filters.push(`ae."toUser" = $${paramIndex}`);
    params.push(toUser);
    paramIndex++;
  }

  if (fromUser) {
    filters.push(`ae."fromUser" = $${paramIndex}`);
    params.push(fromUser);
    paramIndex++;
  }

  if (createdBy) {
    filters.push(`ae."createdBy" = $${paramIndex}`);
    params.push(createdBy);
    paramIndex++;
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
  const orderByColumn = ASSET_EVENTS_SORT_FIELD_MAPPING[sortField] || 'ae."createdAt"';
  const offset = (page - 1) * pageSize;

  const dataQuery = `
    SELECT 
      ae."id",
      ae."assetMasterId",
      ae."eventType",
      ae."fromUser" as "fromUserId",
      ae."toUser" as "toUserId",
      ae."metadata",
      ae."createdAt",
      ae."updatedAt",
      ae."createdBy" as "createdById",
      
      -- Asset details
      json_build_object(
        'id', am."id",
        'assetId', am."assetId",
        'name', av."name",
        'model', av."model",
        'serialNumber', av."serialNumber",
        'category', av."category",
        'status', av."status"
      ) as "asset",
      
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
      
      -- Asset files
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'id', af."id",
              'fileKey', af."fileKey",
              'fileType', af."fileType",
              'label', af."label"
            )
          )
          FROM "assets_files" af
          WHERE af."assetEventsId" = ae."id" AND af."deletedAt" IS NULL
        ),
        '[]'
      ) as "assetFiles"
      
    FROM "assets_events" ae
    LEFT JOIN "asset_masters" am ON ae."assetMasterId" = am."id"
    LEFT JOIN LATERAL (
      SELECT *
      FROM "asset_versions"
      WHERE "assetMasterId" = am."id"
        AND "isActive" = true
        AND "deletedAt" IS NULL
      LIMIT 1
    ) av ON true
    LEFT JOIN "users" cb ON ae."createdBy" = cb."id"
    LEFT JOIN "users" fu ON ae."fromUser" = fu."id"
    LEFT JOIN "users" tu ON ae."toUser" = tu."id"
    ${whereClause}
    ORDER BY ${orderByColumn} ${sortOrder}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  const countQuery = `
    SELECT COUNT(*) as total
    FROM "assets_events" ae
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
