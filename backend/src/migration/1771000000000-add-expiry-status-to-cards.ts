import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExpiryStatusToCards1771000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add expiryStatus column with default value 'VALID'
    await queryRunner.query(`
      ALTER TABLE "cards" 
      ADD COLUMN "expiryStatus" varchar(20) NOT NULL DEFAULT 'VALID'
    `);

    // Create index for expiryStatus column
    await queryRunner.query(`
      CREATE INDEX "idx_cards_expiryStatus" ON "cards" ("expiryStatus")
    `);

    // Update existing cards based on their expiry dates (format: MM/YYYY e.g., 01/2025)
    // Cards expired: expiryDate < today
    // Cards expiring soon: expiryDate within 30 days
    await queryRunner.query(`
      UPDATE "cards"
      SET "expiryStatus" = CASE
        WHEN TO_DATE("expiryDate", 'MM/YYYY') < CURRENT_DATE THEN 'EXPIRED'
        WHEN TO_DATE("expiryDate", 'MM/YYYY') < CURRENT_DATE + INTERVAL '30 days' THEN 'EXPIRING_SOON'
        ELSE 'VALID'
      END
      WHERE "deletedAt" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_cards_expiryStatus"`);

    // Remove expiryStatus column
    await queryRunner.query(`ALTER TABLE "cards" DROP COLUMN "expiryStatus"`);
  }
}
