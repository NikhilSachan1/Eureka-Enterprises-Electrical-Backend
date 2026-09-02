import { Injectable } from '@nestjs/common';
import { AssetFilesRepository } from './asset-files.repository';
import { CreateAssetFileDto } from './dto/create-asset-file.dto';
import { EntityManager } from 'typeorm';

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
  constructor(private readonly assetFilesRepository: AssetFilesRepository) {}

  /**
   * Creates one row per file, each carrying its own fileType and label. Used
   * where the caller knows what each individual file is (asset add/update).
   */
  async createMany(input: CreateManyAssetFilesInput, entityManager?: EntityManager) {
    try {
      const { assetMasterId, assetVersionId, assetEventsId, createdBy, files } = input;
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
