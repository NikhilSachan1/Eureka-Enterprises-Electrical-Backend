import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePaymentSheetItemVerifications1860000000008 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_sheet_item_verifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "itemId" uuid NOT NULL,
        "paymentSheetId" uuid NOT NULL,
        "stage" varchar(30) NOT NULL,
        "verifiedBy" uuid NOT NULL,
        "verifiedAt" timestamp NOT NULL DEFAULT NOW(),
        "createdBy" uuid,
        "updatedBy" uuid,
        "deletedBy" uuid,
        "createdAt" timestamp NOT NULL DEFAULT NOW(),
        "updatedAt" timestamp NOT NULL DEFAULT NOW(),
        "deletedAt" timestamp,
        CONSTRAINT "PK_payment_sheet_item_verifications" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_PS_ITEM_VERIFICATION" UNIQUE ("itemId", "stage"),
        CONSTRAINT "FK_ps_item_verification_item" FOREIGN KEY ("itemId")
          REFERENCES "payment_sheet_items"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_PS_ITEM_VERIFICATION_ITEM" ON "payment_sheet_item_verifications" ("itemId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_PS_ITEM_VERIFICATION_SHEET" ON "payment_sheet_item_verifications" ("paymentSheetId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_sheet_item_verifications"`);
  }
}
