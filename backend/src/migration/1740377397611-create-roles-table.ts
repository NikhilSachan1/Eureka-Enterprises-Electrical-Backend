import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateRolesTable1740377397611 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'roles',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
            isUnique: true,
          },
          {
            name: 'description',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'deletedAt',
            type: 'timestamp',
            isNullable: true,
          },
        ],
        indices: [
          {
            name: 'IDX_ROLES_NAME',
            columnNames: ['name'],
            isUnique: true,
          },
        ],
      }),
    );

    await queryRunner.manager.query(`
          INSERT INTO roles (name, description)
          VALUES 
            ('ADMIN', 'Administrator with full access'),
            ('HR', 'HR with limited access'),
            ('ENGINEER', 'Engineer with limited access'),
            ('DRIVER', 'Driver with limited access'),
            ('MANAGER', 'Manager with limited access')
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('roles');
  }
}
