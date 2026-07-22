import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * JMC system-generated enhancement (1/3).
 *
 * - `fileKey` / `fileName` become NULLABLE: for system-generated JMCs the signed copy is
 *   uploaded later (not at create time). Upload presence is enforced at approval instead.
 * - New `isSystemGenerated` flag: true when the JMC was created through the generate flow
 *   (i.e. it has line items). Existing upload-only rows keep the default `false`.
 *
 * Backward-compatible: existing rows already have fileKey set and isSystemGenerated=false.
 */
export class AlterJmcsNullableFileAddSystemGenerated1860000000029 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "jmcs" ALTER COLUMN "fileKey" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "jmcs" ALTER COLUMN "fileName" DROP NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "jmcs" ADD COLUMN IF NOT EXISTS "isSystemGenerated" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "jmcs" DROP COLUMN IF EXISTS "isSystemGenerated"`);
    // Re-tighten NOT NULL only if no NULLs exist (rows created after this migration may have none).
    await queryRunner.query(
      `UPDATE "jmcs" SET "fileKey" = '' WHERE "fileKey" IS NULL;
       UPDATE "jmcs" SET "fileName" = '' WHERE "fileName" IS NULL;`,
    );
    await queryRunner.query(`ALTER TABLE "jmcs" ALTER COLUMN "fileKey" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "jmcs" ALTER COLUMN "fileName" SET NOT NULL`);
  }
}
