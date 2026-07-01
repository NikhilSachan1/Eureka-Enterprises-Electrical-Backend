import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCompanyBankAccountsTable1860000000010 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "company_bank_accounts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "accountName" varchar(255) NOT NULL,
        "accountHolderName" varchar(255) NOT NULL,
        "bankName" varchar(255) NOT NULL,
        "accountNumber" varchar(50) NOT NULL,
        "ifscCode" varchar(20) NOT NULL,
        "branchName" varchar(255),
        "isActive" boolean NOT NULL DEFAULT true,
        "isDefault" boolean NOT NULL DEFAULT false,
        "remarks" text,
        "createdBy" uuid,
        "updatedBy" uuid,
        "deletedBy" uuid,
        "createdAt" timestamp NOT NULL DEFAULT NOW(),
        "updatedAt" timestamp NOT NULL DEFAULT NOW(),
        "deletedAt" timestamp,
        CONSTRAINT "PK_company_bank_accounts" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_COMPANY_BANK_ACCOUNT_ACTIVE" ON "company_bank_accounts" ("isActive")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "company_bank_accounts"`);
  }
}
