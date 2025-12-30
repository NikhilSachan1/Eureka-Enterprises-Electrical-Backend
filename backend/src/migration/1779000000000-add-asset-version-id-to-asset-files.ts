import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

export class AddAssetVersionIdToAssetFiles1779000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'assets_files',
      new TableColumn({
        name: 'assetVersionId',
        type: 'uuid',
        isNullable: true,
      }),
    );

    await queryRunner.createIndex(
      'assets_files',
      new TableIndex({
        name: 'idx_assets_files_asset_version_id',
        columnNames: ['assetVersionId'],
      }),
    );

    await queryRunner.createForeignKey(
      'assets_files',
      new TableForeignKey({
        name: 'fk_assets_files_asset_version_id',
        columnNames: ['assetVersionId'],
        referencedTableName: 'asset_versions',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('assets_files', 'fk_assets_files_asset_version_id');
    await queryRunner.dropIndex('assets_files', 'idx_assets_files_asset_version_id');
    await queryRunner.dropColumn('assets_files', 'assetVersionId');
  }
}
