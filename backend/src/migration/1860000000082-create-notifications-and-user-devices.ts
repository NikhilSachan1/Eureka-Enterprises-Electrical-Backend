import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `notifications` — what the bell shows, and what a push says. `user_devices` — where pushes go.
 *
 * One row per recipient per event. The bell and the push are both read from that row, so what a
 * person sees on their lock screen is exactly what is waiting in the bell, word for word. A row
 * belongs to a user, not a device: read it on the web and it is read in the app.
 *
 * An event that today sends both an email and a WhatsApp still makes one row here — the channels
 * are independent of each other, and the bell is a record of things that happened, not of
 * messages sent.
 *
 * `dedupeKey` exists for the crons. Some of them run many times a day over the same records (the
 * calibration-expiry cron sent ~21k emails in 30 days); a bell that showed each run would be
 * useless. The unique index makes a repeat simply not insert.
 */
export class CreateNotificationsAndUserDevices1860000000082 implements MigrationInterface {
  name = 'CreateNotificationsAndUserDevices1860000000082';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id"            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId"        uuid NOT NULL REFERENCES "users"("id"),
        "title"         varchar(120) NOT NULL,
        "message"       varchar(500) NOT NULL,
        "category"      varchar(64) NOT NULL,
        "referenceType" varchar(64) NULL,
        "referenceId"   uuid NULL,
        "route"         varchar(255) NULL,
        "data"          jsonb NULL,
        "dedupeKey"     varchar(160) NULL,
        "isRead"        boolean NOT NULL DEFAULT false,
        "readAt"        timestamp NULL,
        "createdBy"     uuid NULL,
        "updatedBy"     uuid NULL,
        "deletedBy"     uuid NULL,
        "createdAt"     timestamp NOT NULL DEFAULT now(),
        "updatedAt"     timestamp NOT NULL DEFAULT now(),
        "deletedAt"     timestamp NULL
      )
    `);

    await queryRunner.query(`
      COMMENT ON TABLE "notifications" IS
        'Bell and push content, one row per recipient per event. Never holds passwords, OTPs, reset links or bank details.'
    `);

    // The bell list and the unread badge both read exactly this.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_notifications_user_read_created"
        ON "notifications" ("userId", "isRead", "createdAt" DESC)
        WHERE "deletedAt" IS NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_notifications_user_dedupe"
        ON "notifications" ("userId", "dedupeKey")
        WHERE "dedupeKey" IS NOT NULL
    `);

    // The retention sweep deletes by age.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_notifications_created"
        ON "notifications" ("createdAt")
        WHERE "deletedAt" IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_devices" (
        "id"          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId"      uuid NOT NULL REFERENCES "users"("id"),
        "token"       text NOT NULL,
        "platform"    varchar(16) NOT NULL,
        "endpointArn" text NULL,
        "deviceName"  varchar(120) NULL,
        "appVersion"  varchar(40) NULL,
        "lastSeenAt"  timestamp NOT NULL DEFAULT now(),
        "isActive"    boolean NOT NULL DEFAULT true,
        "createdBy"   uuid NULL,
        "updatedBy"   uuid NULL,
        "deletedBy"   uuid NULL,
        "createdAt"   timestamp NOT NULL DEFAULT now(),
        "updatedAt"   timestamp NOT NULL DEFAULT now(),
        "deletedAt"   timestamp NULL,
        CONSTRAINT "chk_user_devices_platform" CHECK ("platform" IN ('android', 'ios', 'web'))
      )
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "user_devices"."endpointArn" IS
        'The SNS platform endpoint for this token. Null until SNS has accepted it — push is skipped for such a device.'
    `);

    // A token is one physical install. If somebody else logs in on the same phone it moves to
    // them, so the previous user stops receiving pushes on a device they no longer hold.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_user_devices_token"
        ON "user_devices" ("token")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_user_devices_user_active"
        ON "user_devices" ("userId")
        WHERE "isActive" = true AND "deletedAt" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_devices"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications"`);
  }
}
