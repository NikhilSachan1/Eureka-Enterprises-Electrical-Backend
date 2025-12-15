import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateAnnouncementTargetsTable1765000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'announcement_targets',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'announcementId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'targetType',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'targetId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'deletedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'createdBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'updatedBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'deletedBy',
            type: 'uuid',
            isNullable: true,
          },
        ],
        uniques: [
          {
            name: 'uniq_announcement_target',
            columnNames: ['announcementId', 'targetType', 'targetId'],
          },
        ],
      }),
      true,
    );

    // Create foreign key to announcements
    await queryRunner.createForeignKey(
      'announcement_targets',
      new TableForeignKey({
        columnNames: ['announcementId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'announcements',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );

    // Create foreign keys for audit columns
    await queryRunner.createForeignKey(
      'announcement_targets',
      new TableForeignKey({
        columnNames: ['createdBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'announcement_targets',
      new TableForeignKey({
        columnNames: ['updatedBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'announcement_targets',
      new TableForeignKey({
        columnNames: ['deletedBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    // Create indexes
    await queryRunner.createIndex(
      'announcement_targets',
      new TableIndex({
        name: 'idx_announcement_targets_lookup',
        columnNames: ['targetType', 'targetId'],
      }),
    );

    await queryRunner.createIndex(
      'announcement_targets',
      new TableIndex({
        name: 'idx_announcement_targets_announcementId',
        columnNames: ['announcementId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('announcement_targets');
  }
}
