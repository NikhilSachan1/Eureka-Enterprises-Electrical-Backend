import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePaymentSheetTables1860000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── payment_sheets ─────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_sheets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sheetNumber" varchar(50) NOT NULL,
        "title" varchar(255),
        "remarks" text,
        "financialYear" varchar(10) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'DRAFT',
        "currentStage" varchar(30),
        "totalRequestedAmount" decimal(15,2) NOT NULL DEFAULT 0,
        "totalCurrentAmount" decimal(15,2) NOT NULL DEFAULT 0,
        "totalPaidAmount" decimal(15,2) NOT NULL DEFAULT 0,
        "pdfKey" varchar(500),
        "createdBy" uuid,
        "updatedBy" uuid,
        "deletedBy" uuid,
        "createdAt" timestamp NOT NULL DEFAULT NOW(),
        "updatedAt" timestamp NOT NULL DEFAULT NOW(),
        "deletedAt" timestamp,
        CONSTRAINT "PK_payment_sheets" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_payment_sheets_sheetNumber" UNIQUE ("sheetNumber")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_PAYMENT_SHEET_STATUS" ON "payment_sheets" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_PAYMENT_SHEET_STAGE" ON "payment_sheets" ("currentStage")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_PAYMENT_SHEET_FY" ON "payment_sheets" ("financialYear")`,
    );

    // ── payment_sheet_items ────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_sheet_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "paymentSheetId" uuid NOT NULL,
        "beneficiaryType" varchar(10) NOT NULL,
        "userId" uuid,
        "vendorId" uuid,
        "sourceType" varchar(20) NOT NULL,
        "pendingSnapshot" decimal(15,2) NOT NULL,
        "requestedAmount" decimal(15,2) NOT NULL,
        "currentAmount" decimal(15,2) NOT NULL,
        "bankSnapshot" jsonb,
        "itemStatus" varchar(20) NOT NULL DEFAULT 'PENDING',
        "paidAmount" decimal(15,2),
        "paidAt" timestamp,
        "paymentRef" varchar(500),
        "holdReason" text,
        "heldBy" uuid,
        "rejectReason" text,
        "createdBy" uuid,
        "updatedBy" uuid,
        "deletedBy" uuid,
        "createdAt" timestamp NOT NULL DEFAULT NOW(),
        "updatedAt" timestamp NOT NULL DEFAULT NOW(),
        "deletedAt" timestamp,
        CONSTRAINT "PK_payment_sheet_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_payment_sheet_items_sheet" FOREIGN KEY ("paymentSheetId")
          REFERENCES "payment_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_PAYMENT_SHEET_ITEM_SHEET" ON "payment_sheet_items" ("paymentSheetId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_PAYMENT_SHEET_ITEM_USER" ON "payment_sheet_items" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_PAYMENT_SHEET_ITEM_VENDOR" ON "payment_sheet_items" ("vendorId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_PAYMENT_SHEET_ITEM_STATUS" ON "payment_sheet_items" ("itemStatus")`,
    );

    // ── payment_sheet_item_book_payments ───────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_sheet_item_book_payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "itemId" uuid NOT NULL,
        "bookPaymentId" uuid NOT NULL,
        "allocatedAmount" decimal(15,2) NOT NULL,
        "bankTransferId" uuid,
        "createdBy" uuid,
        "updatedBy" uuid,
        "deletedBy" uuid,
        "createdAt" timestamp NOT NULL DEFAULT NOW(),
        "updatedAt" timestamp NOT NULL DEFAULT NOW(),
        "deletedAt" timestamp,
        CONSTRAINT "PK_payment_sheet_item_book_payments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ps_item_bp_item" FOREIGN KEY ("itemId")
          REFERENCES "payment_sheet_items"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_PS_ITEM_BP_ITEM" ON "payment_sheet_item_book_payments" ("itemId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_PS_ITEM_BP_BOOK_PAYMENT" ON "payment_sheet_item_book_payments" ("bookPaymentId")`,
    );

    // ── payment_sheet_item_history ─────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_sheet_item_history" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "itemId" uuid NOT NULL,
        "paymentSheetId" uuid NOT NULL,
        "stage" varchar(30),
        "action" varchar(20) NOT NULL,
        "previousAmount" decimal(15,2),
        "newAmount" decimal(15,2),
        "reason" text,
        "createdBy" uuid,
        "updatedBy" uuid,
        "deletedBy" uuid,
        "createdAt" timestamp NOT NULL DEFAULT NOW(),
        "updatedAt" timestamp NOT NULL DEFAULT NOW(),
        "deletedAt" timestamp,
        CONSTRAINT "PK_payment_sheet_item_history" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_PS_ITEM_HISTORY_ITEM" ON "payment_sheet_item_history" ("itemId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_PS_ITEM_HISTORY_SHEET" ON "payment_sheet_item_history" ("paymentSheetId")`,
    );

    // ── payment_sheet_stage_logs ───────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_sheet_stage_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "paymentSheetId" uuid NOT NULL,
        "fromStage" varchar(30),
        "toStage" varchar(30),
        "action" varchar(20) NOT NULL,
        "actedBy" uuid,
        "actedRole" varchar(50),
        "remarks" text,
        "createdBy" uuid,
        "updatedBy" uuid,
        "deletedBy" uuid,
        "createdAt" timestamp NOT NULL DEFAULT NOW(),
        "updatedAt" timestamp NOT NULL DEFAULT NOW(),
        "deletedAt" timestamp,
        CONSTRAINT "PK_payment_sheet_stage_logs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_PS_STAGE_LOG_SHEET" ON "payment_sheet_stage_logs" ("paymentSheetId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_sheet_stage_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_sheet_item_history"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_sheet_item_book_payments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_sheet_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_sheets"`);
  }
}
