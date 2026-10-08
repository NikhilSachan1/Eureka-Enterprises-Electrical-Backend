import { VehicleEventTypes } from 'src/modules/vehicle-masters/constants/vehicle-masters.constants';

/**
 * The vehicle an employee was holding on a given day.
 *
 * Deliberately **not** read from `assignmentSnapshot` any more. The driver used to pick the
 * registration number in the app, which meant attendance recorded what somebody typed rather than
 * what the office had actually handed them, and a wrong pick stayed wrong for ever. The office
 * already records every handover; attendance should just read it.
 *
 * Nor is it read from `vehicle_versions.assignedTo`, which only says who holds the vehicle *now*.
 * Last month's attendance would then show the driver who was given the van yesterday. The events
 * carry a timestamp, so replaying them to the end of the day in question gives the holder on that
 * day — and a handover corrected later lands on every day it covers, with nobody re-opening an
 * attendance record. Same reasoning as the allocated site.
 *
 * Replayed against the real data on dev, this agrees with `assignedTo` for every vehicle.
 */

/**
 * Events that change who physically holds a vehicle.
 *
 * `HANDOVER_INITIATED` is a request, not a transfer — the vehicle stays with the sender until it
 * is accepted — and `HANDOVER_REJECTED` / `HANDOVER_CANCELLED` end that request without moving
 * anything. Counting any of the three would hand the vehicle over on the day it was merely
 * offered. `UPDATED`, `AVAILABLE`, `UNDER_MAINTENANCE` and `DAMAGED` do not move it either.
 */
const GAINED = [
  VehicleEventTypes.ASSIGNED,
  VehicleEventTypes.HANDOVER_ACCEPTED,
  VehicleEventTypes.HANDOVER_AUTO_ACCEPTED,
];

/** Events that end possession without naming a new holder. */
const LOST = [VehicleEventTypes.DEALLOCATED, VehicleEventTypes.RETIRED];

const quoted = (types: VehicleEventTypes[]) => types.map((t) => `'${t}'`).join(', ');

/**
 * The latest possession event for each vehicle as at the end of `dateCol`, and who it left the
 * vehicle with.
 *
 * `< date + 1 day` rather than `<= date`, because events are timestamps and attendance is a date:
 * a handover at 3pm counts for that day.
 */
const heldOn = (dateCol: string) => `
  SELECT ve."toUser" AS holder, ve."createdAt" AS "since"
    FROM vehicles_events ve
   WHERE ve."vehicleMasterId" = vm."id"
     AND ve."deletedAt" IS NULL
     AND ve."eventType" IN (${quoted([...GAINED, ...LOST])})
     AND ve."createdAt" < (${dateCol}::date + INTERVAL '1 day')
   ORDER BY ve."createdAt" DESC
   LIMIT 1
`;

/**
 * A correlated sub-select returning the held vehicle for one attendance row, as JSON.
 *
 * A LATERAL join rather than a per-row lookup, so a month of attendance for a whole team stays one
 * query.
 *
 * One vehicle per person is the rule, and `LIMIT 1` holds to it. It is ordered by the handover
 * date so that if the data ever breaks that rule the answer is at least stable and explainable —
 * the most recently handed over — rather than whichever row the planner happened to return first,
 * which is what the code it replaces did.
 */
export const heldVehicleLateral = (userCol: string, dateCol: string) => `
  LEFT JOIN LATERAL (
    SELECT jsonb_build_object(
             'id', vm."id",
             'registrationNo', vm."registrationNo"
           ) AS vehicle
      FROM vehicle_masters vm
      JOIN LATERAL (${heldOn(dateCol)}) last ON TRUE
     WHERE vm."deletedAt" IS NULL
       AND last.holder = ${userCol}
     ORDER BY last."since" DESC
     LIMIT 1
  ) held_vehicle ON TRUE
`;

/**
 * The same lookup for a single employee and day — for the paths that handle one record.
 *
 * `$1` userId, `$2` the date.
 */
export const heldVehicleForDayQuery = `
  SELECT vm."id", vm."registrationNo"
    FROM vehicle_masters vm
    JOIN LATERAL (${heldOn('$2')}) last ON TRUE
   WHERE vm."deletedAt" IS NULL
     AND last.holder = $1
   ORDER BY last."since" DESC
   LIMIT 1
`;
