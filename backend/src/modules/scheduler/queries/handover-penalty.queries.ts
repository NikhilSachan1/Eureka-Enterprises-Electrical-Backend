import { AssetEventTypes } from 'src/modules/asset-masters/constants/asset-masters.constants';
import { UserStatus } from 'src/modules/users/constants/user.constants';

/**
 * Handovers that have sat untouched past the window.
 *
 * "Untouched" reuses the definition the service already works to: a handover is pending while the
 * *last* event on that item is HANDOVER_INITIATED (`asset-events.service.ts:124`). So rather than
 * looking for the absence of three specific event types, this looks for the absence of *any* later
 * event — which also covers a deallocation, a loss, or anything else that has since happened and
 * should stop the penalty.
 *
 * The two modules differ only in table and column names, so one builder serves both.
 */
const buildStaleHandoverQuery = (opts: {
  eventsTable: string;
  versionsTable: string;
  itemIdColumn: string;
  labelExpression: string;
  identifierExpression: string;
}) => {
  const { eventsTable, versionsTable, itemIdColumn, labelExpression, identifierExpression } = opts;

  return `
    SELECT
      e.id                         AS "eventId",
      e."${itemIdColumn}"          AS "itemId",
      e."toUser"                   AS "receiverId",
      e."fromUser"                 AS "initiatorId",
      e."createdAt"                AS "initiatedAt",
      v.id                         AS "versionId",
      ${labelExpression}           AS "itemLabel",
      ${identifierExpression}      AS "itemIdentifier",
      u."firstName"                AS "receiverFirstName",
      u."lastName"                 AS "receiverLastName",
      u."status"                   AS "receiverStatus",
      u."whatsappOptIn"            AS "receiverWhatsappOptIn",
      COALESCE(u."whatsappNumber", u."contactNumber") AS "receiverPhone"
    FROM ${eventsTable} e
    JOIN ${versionsTable} v
      ON v."${itemIdColumn}" = e."${itemIdColumn}"
     AND v."isActive" = true
     AND v."deletedAt" IS NULL
    JOIN users u
      ON u.id = e."toUser"
     AND u."deletedAt" IS NULL
    WHERE e."eventType" = '${AssetEventTypes.HANDOVER_INITIATED}'
      AND e."deletedAt" IS NULL
      AND e."toUser" IS NOT NULL
      AND e."createdAt" <= NOW() - ($1 || ' hours')::interval
      AND NOT EXISTS (
        SELECT 1
          FROM ${eventsTable} later
         WHERE later."${itemIdColumn}" = e."${itemIdColumn}"
           AND later."deletedAt" IS NULL
           AND later."createdAt" > e."createdAt"
      )
    ORDER BY e."createdAt" ASC
  `;
};

export const getStaleAssetHandoversQuery = (hours: number) => ({
  query: buildStaleHandoverQuery({
    eventsTable: 'assets_events',
    versionsTable: 'asset_versions',
    itemIdColumn: 'assetMasterId',
    labelExpression: `COALESCE(v."name", 'Asset')`,
    identifierExpression: `v."serialNumber"`,
  }),
  params: [String(hours)],
});

export const getStaleVehicleHandoversQuery = (hours: number) => ({
  query: buildStaleHandoverQuery({
    eventsTable: 'vehicles_events',
    versionsTable: 'vehicle_versions',
    itemIdColumn: 'vehicleMasterId',
    labelExpression: `COALESCE(NULLIF(TRIM(CONCAT_WS(' ', v."brand", v."model")), ''), 'Vehicle')`,
    identifierExpression: `v."registrationNo"`,
  }),
  params: [String(hours)],
});

/**
 * Re-read of a single item's latest event, taken inside the transaction that is about to act.
 *
 * Two overlapping runs could both select the same row above, and the penalty must not be applied
 * twice. The row is locked so the loser waits, then sees the auto-accept event the winner wrote and
 * skips.
 */
export const getLatestEventForUpdateQuery = (eventsTable: string, itemIdColumn: string) => `
  SELECT id, "eventType"
    FROM ${eventsTable}
   WHERE "${itemIdColumn}" = $1
     AND "deletedAt" IS NULL
   ORDER BY "createdAt" DESC
   LIMIT 1
   FOR UPDATE
`;

export const isArchived = (status: string | null | undefined): boolean =>
  status === UserStatus.ARCHIVED;
