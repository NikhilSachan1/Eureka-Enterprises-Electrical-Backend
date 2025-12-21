import { Injectable } from '@nestjs/common';
import { AssetFilesRepository } from './asset-files.repository';
import { CreateAssetFileDto } from './dto/create-asset-file.dto';
import { EntityManager } from 'typeorm';

@Injectable()
export class AssetFilesService {
  constructor(private readonly assetFilesRepository: AssetFilesRepository) {}

  async create(
    createAssetFileDto: CreateAssetFileDto & { createdBy: string },
    entityManager?: EntityManager,
  ) {
    try {
      const { assetMasterId, fileType, fileKeys, createdBy, assetEventsId, label } =
        createAssetFileDto;
      if (fileKeys) {
        for (const fileKey of fileKeys) {
          await this.assetFilesRepository.create(
            {
              assetMasterId,
              fileType,
              fileKey,
              label,
              createdBy,
              assetEventsId,
              updatedBy: createdBy,
            },
            entityManager,
          );
        }
      }
      return true;
    } catch (error) {
      throw error;
    }
  }
}
