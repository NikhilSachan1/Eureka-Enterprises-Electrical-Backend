import { VehicleEventTypes } from 'src/modules/vehicle-masters/constants/vehicle-masters.constants';

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
