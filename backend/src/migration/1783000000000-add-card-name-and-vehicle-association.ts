import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

export class AddCardNameAndVehicleAssociation1783000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'cards',
      new TableColumn({
        name: 'cardName',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    );

    await queryRunner.changeColumn(
      'cards',
      'holderName',
      new TableColumn({
        name: 'holderName',
        type: 'varchar',
        isNullable: true,
      }),
    );

    await queryRunner.changeColumn(
      'cards',
      'expiryDate',
      new TableColumn({
        name: 'expiryDate',
        type: 'varchar',
        isNullable: true,
      }),
    );

    await queryRunner.createIndex(
      'cards',
      new TableIndex({
        name: 'idx_cards_cardName',
        columnNames: ['cardName'],
      }),
    );

    await queryRunner.addColumn(
      'vehicle_masters',
      new TableColumn({
        name: 'cardId',
        type: 'uuid',
        isNullable: true,
        isUnique: true,
      }),
    );

    await queryRunner.createForeignKey(
      'vehicle_masters',
      new TableForeignKey({
        name: 'FK_vehicle_masters_cardId',
        columnNames: ['cardId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'cards',
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createIndex(
      'vehicle_masters',
      new TableIndex({
        name: 'idx_vehicle_masters_cardId',
        columnNames: ['cardId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('vehicle_masters', 'idx_vehicle_masters_cardId');
    await queryRunner.dropForeignKey('vehicle_masters', 'FK_vehicle_masters_cardId');
    await queryRunner.dropColumn('vehicle_masters', 'cardId');
    await queryRunner.dropIndex('cards', 'idx_cards_cardName');
    await queryRunner.dropColumn('cards', 'cardName');
    await queryRunner.changeColumn(
      'cards',
      'holderName',
      new TableColumn({
        name: 'holderName',
        type: 'varchar',
        isNullable: false,
        default: "''",
      }),
    );

    await queryRunner.changeColumn(
      'cards',
      'expiryDate',
      new TableColumn({
        name: 'expiryDate',
        type: 'varchar',
        isNullable: false,
        default: "'01/2099'",
      }),
    );
  }
}
