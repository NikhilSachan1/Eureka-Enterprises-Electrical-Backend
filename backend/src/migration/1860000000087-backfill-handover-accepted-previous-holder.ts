import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fills the previous holder (`fromUser`) of HANDOVER_ACCEPTED events that were saved without one.
 *
 * On accept, the services stored the item's current assignee as the previous holder. When the
 * handover was started straight from stock (an AVAILABLE asset or vehicle, initiated by an admin)
 * there is no assignee, so `fromUser` was saved as NULL and the event history showed "-" where the
 * initiated row right above it named the sender. The services now fall back to the initiator; this
 * repairs the rows written before that.
 *
 * Each row takes the `fromUser` of the latest HANDOVER_INITIATED event on the same item at or
 * before the accept — the request it answered. Only NULL values are touched, so a real previous
 * holder is never overwritten. Covers assets and vehicles.
 *
 * Other events need nothing: HANDOVER_AUTO_ACCEPTED already stores the initiator, and the event
 * history query already shows rejected / cancelled handovers as staying with the initiator.
 */
export class BackfillHandoverAcceptedPreviousHolder1860000000087 implements MigrationInterface {
  name = 'BackfillHandoverAcceptedPreviousHolder1860000000087';

  private static readonly TABLES: Array<[table: string, masterColumn: string]> = [
    ['assets_events', 'assetMasterId'],
    ['vehicles_events', 'vehicleMasterId'],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [
      table,
      masterColumn,
    ] of BackfillHandoverAcceptedPreviousHolder1860000000087.TABLES) {
      await queryRunner.query(
        `UPDATE ${table} e
            SET "fromUser" = (
                  SELECT i."fromUser"
                    FROM ${table} i
                   WHERE i."${masterColumn}" = e."${masterColumn}"
                     AND i."eventType" = 'HANDOVER_INITIATED'
                     AND i."deletedAt" IS NULL
                     AND i."createdAt" <= e."createdAt"
                   ORDER BY i."createdAt" DESC
                   LIMIT 1)
          WHERE e."eventType" = 'HANDOVER_ACCEPTED'
            AND e."fromUser" IS NULL
            AND e."deletedAt" IS NULL`,
      );
    }
  }

  /**
   * Nothing to undo. The filled rows are not marked, so they cannot be told apart from accepts that
   * had a real previous holder, and putting NULL back would only bring the "-" back.
   */
  public async down(): Promise<void> {}
}
