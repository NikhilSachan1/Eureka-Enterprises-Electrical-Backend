import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class RenameVehicleVersionNumberToRegistrationNo1790000000000 implements MigrationInterface {
  private readonly tableName = 'vehicle_versions';
  private readonly oldColumnName = 'number';
  private readonly newColumnName = 'registrationNo';
  private readonly oldIndexName = 'idx_vehicles_number';
  private readonly newIndexName = 'idx_vehicles_registrationNo';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the old index
    await queryRunner.dropIndex(this.tableName, this.oldIndexName);

    // Rename the column
    await queryRunner.renameColumn(this.tableName, this.oldColumnName, this.newColumnName);

    // Create new index with updated name
    await queryRunner.createIndex(
      this.tableName,
      new TableIndex({
        name: this.newIndexName,
        columnNames: [this.newColumnName],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the new index
    await queryRunner.dropIndex(this.tableName, this.newIndexName);

    // Rename the column back
    await queryRunner.renameColumn(this.tableName, this.newColumnName, this.oldColumnName);

    // Recreate old index
    await queryRunner.createIndex(
      this.tableName,
      new TableIndex({
        name: this.oldIndexName,
        columnNames: [this.oldColumnName],
      }),
    );
  }
}
