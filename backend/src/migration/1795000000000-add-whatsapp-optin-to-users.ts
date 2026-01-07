import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddWhatsappOptinToUsers1795000000000 implements MigrationInterface {
  name = 'AddWhatsappOptinToUsers1795000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add WhatsApp opt-in column
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'whatsappOptIn',
        type: 'boolean',
        default: false,
        isNullable: false,
      }),
    );

    // Add WhatsApp number column (can be different from contact number)
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'whatsappNumber',
        type: 'varchar',
        length: '20',
        isNullable: true,
      }),
    );

    // Add WhatsApp opt-in timestamp
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'whatsappOptInAt',
        type: 'timestamp',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'whatsappOptInAt');
    await queryRunner.dropColumn('users', 'whatsappNumber');
    await queryRunner.dropColumn('users', 'whatsappOptIn');
  }
}
