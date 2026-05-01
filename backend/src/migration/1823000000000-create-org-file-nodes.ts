import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrgFileNodes1823000000000 implements MigrationInterface {
  name = 'CreateOrgFileNodes1823000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "org_file_nodes" (
        "id"         uuid              NOT NULL DEFAULT uuid_generate_v4(),
        "name"       varchar(255)      NOT NULL,
        "type"       varchar(10)       NOT NULL,
        "parentId"   uuid              NULL,
        "storageKey" varchar(1000)     NULL,
        "mimeType"   varchar(100)      NULL,
        "size"       bigint            NULL,
        "createdBy"  uuid              NULL,
        "updatedBy"  uuid              NULL,
        "deletedBy"  uuid              NULL,
        "createdAt"  timestamp         NOT NULL DEFAULT NOW(),
        "updatedAt"  timestamp         NOT NULL DEFAULT NOW(),
        "deletedAt"  timestamp         NULL,
        CONSTRAINT "PK_org_file_nodes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_org_file_nodes_parent" FOREIGN KEY ("parentId")
          REFERENCES "org_file_nodes" ("id") ON DELETE SET NULL,
        CONSTRAINT "FK_org_file_nodes_created_by" FOREIGN KEY ("createdBy")
          REFERENCES "users" ("id") ON DELETE SET NULL,
        CONSTRAINT "FK_org_file_nodes_updated_by" FOREIGN KEY ("updatedBy")
          REFERENCES "users" ("id") ON DELETE SET NULL,
        CONSTRAINT "FK_org_file_nodes_deleted_by" FOREIGN KEY ("deletedBy")
          REFERENCES "users" ("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ORG_FILE_NODE_PARENT" ON "org_file_nodes" ("parentId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ORG_FILE_NODE_TYPE" ON "org_file_nodes" ("type")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ORG_FILE_NODE_TYPE"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ORG_FILE_NODE_PARENT"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "org_file_nodes"`);
  }
}
