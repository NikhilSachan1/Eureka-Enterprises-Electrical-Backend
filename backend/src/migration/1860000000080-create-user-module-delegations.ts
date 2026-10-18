import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `user_module_delegations` — who may act on whose behalf, per module.
 *
 * The permission tables already answer "what may this person do". Nothing answered "for whom",
 * and so it sat hardcoded in two copies of an interceptor: *an employee may only ever touch his
 * own rows*. That is right for almost everybody and wrong for the one person in an office who
 * enters everybody else's expenses.
 *
 * Deliberately a separate table rather than another permission. A permission that meant "may add
 * expenses for Ravi" would need a new permission per person per module, and the two questions
 * would stop being separable — which is exactly what keeps approval out of reach here: a
 * delegation widens *whose* rows you may touch and never *what* you may do, so someone who cannot
 * approve still cannot approve, no matter how many people they manage.
 *
 * `module` is a plain string holding a value from the `permission/modules` config
 * (`expense`, `fuel`, …) rather than an enum, because that list is edited in config and a database
 * enum would have to be migrated every time it changed. Only `expense` and `fuel` are honoured
 * today; a row naming anything else simply never matches.
 *
 * Dates because the relationship ends — somebody changes desk — and the record of who entered
 * what must stay true afterwards. An open `effectiveTo` means "until further notice".
 *
 * No unique constraint on (manager, member, module): two people may share responsibility for the
 * same person, which was asked for. The partial index below only stops the *same* pair being
 * granted twice while both grants are open.
 */
export class CreateUserModuleDelegations1860000000080 implements MigrationInterface {
  name = 'CreateUserModuleDelegations1860000000080';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_module_delegations" (
        "id"            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "managerId"     uuid NOT NULL REFERENCES "users"("id"),
        "memberId"      uuid NOT NULL REFERENCES "users"("id"),
        "module"        varchar(64) NOT NULL,
        "effectiveFrom" date NOT NULL DEFAULT CURRENT_DATE,
        "effectiveTo"   date NULL,
        "remarks"       text NULL,
        "createdBy"     uuid NULL,
        "updatedBy"     uuid NULL,
        "deletedBy"     uuid NULL,
        "createdAt"     timestamp NOT NULL DEFAULT now(),
        "updatedAt"     timestamp NOT NULL DEFAULT now(),
        "deletedAt"     timestamp NULL,
        CONSTRAINT "chk_delegation_not_self" CHECK ("managerId" <> "memberId"),
        CONSTRAINT "chk_delegation_dates" CHECK ("effectiveTo" IS NULL OR "effectiveTo" >= "effectiveFrom")
      )
    `);

    await queryRunner.query(`
      COMMENT ON TABLE "user_module_delegations" IS
        'Who may act on whose behalf, per module. Widens which rows a person may touch; never what actions they may take.'
    `);

    // The resolver asks "which members does this manager have, for this module, today" on every
    // list and every create, so that is the index.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_delegation_manager_module"
        ON "user_module_delegations" ("managerId", "module")
        WHERE "deletedAt" IS NULL
    `);

    // The other direction, for "who manages Ravi" on an admin screen.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_delegation_member_module"
        ON "user_module_delegations" ("memberId", "module")
        WHERE "deletedAt" IS NULL
    `);

    // One open grant per pair per module. A closed one may sit beside it — that is history.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_delegation_open_pair"
        ON "user_module_delegations" ("managerId", "memberId", "module")
        WHERE "deletedAt" IS NULL AND "effectiveTo" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_module_delegations"`);
  }
}
