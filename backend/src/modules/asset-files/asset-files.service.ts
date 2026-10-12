import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { AssetFilesRepository } from './asset-files.repository';
import { CreateAssetFileDto } from './dto/create-asset-file.dto';
import { DataSource, EntityManager } from 'typeorm';

export interface AssetFileToCreate {
  fileKey: string;
  fileType: string;
  label?: string | null;
}

export interface CreateManyAssetFilesInput {
  assetMasterId: string;
  assetVersionId?: string;
  assetEventsId?: string;
  createdBy: string;
  files: AssetFileToCreate[];
}

@Injectable()
export class AssetFilesService {
  constructor(
    private readonly assetFilesRepository: AssetFilesRepository,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
   * The asset's active version, for callers that do not name one.
   *
   * Most callers do not: the calibration action, for instance, passes only the asset and the
   * event. The column was then left null, and every read that joined on it — the report and the
   * public certificate link both do — could not see the file at all. Filling it here fixes the
   * cause rather than teaching each reader to cope with a null.
   */
  private async activeVersionId(
    assetMasterId: string,
    entityManager?: EntityManager,
  ): Promise<string | undefined> {
    const runner = entityManager ?? this.dataSource;
    const [row] = await runner.query(
      `SELECT id FROM asset_versions
        WHERE "assetMasterId" = $1 AND "isActive" = true AND "deletedAt" IS NULL
        LIMIT 1`,
      [assetMasterId],
    );
    return row?.id;
  }

  /**
   * Creates one row per file, each carrying its own fileType and label. Used
   * where the caller knows what each individual file is (asset add/update).
   */
  async createMany(input: CreateManyAssetFilesInput, entityManager?: EntityManager) {
    try {
      const { assetMasterId, assetEventsId, createdBy, files } = input;
      const assetVersionId =
        input.assetVersionId ?? (await this.activeVersionId(assetMasterId, entityManager));
      for (const file of files) {
        await this.assetFilesRepository.create(
          {
            assetMasterId,
            assetVersionId,
            fileType: file.fileType,
            fileKey: file.fileKey,
            label: file.label ?? null,
            createdBy,
            assetEventsId,
            updatedBy: createdBy,
          },
          entityManager,
        );
      }
      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Batch create where every file shares one fileType and label.
   * Kept as the entry point for callers that upload a homogeneous batch.
   */
  async create(
    createAssetFileDto: CreateAssetFileDto & { createdBy: string },
    entityManager?: EntityManager,
  ) {
    try {
      const { assetMasterId, assetVersionId, fileType, fileKeys, createdBy, assetEventsId, label } =
        createAssetFileDto;
      if (fileKeys) {
        return await this.createMany(
          {
            assetMasterId,
            assetVersionId,
            assetEventsId,
            createdBy,
            files: fileKeys.map((fileKey) => ({ fileKey, fileType, label })),
          },
          entityManager,
        );
      }
      return true;
    } catch (error) {
      throw error;
    }
  }
}
