import { Injectable } from '@nestjs/common';
import { UserDocumentRepository } from './user-document.repository';
import { UserDocumentEntity } from './entities/user-document.entity';
import { EntityManager, FindManyOptions, FindOptionsWhere } from 'typeorm';

@Injectable()
export class UserDocumentService {
  constructor(private readonly userDocumentRepository: UserDocumentRepository) {}

  async create(
    documents: {
      userId: string;
      documentType: string;
      fileKeys: string[];
      fileNames?: string[];
      createdBy: string;
    },
    entityManager?: EntityManager,
  ): Promise<UserDocumentEntity[]> {
    const { userId, documentType, fileKeys, fileNames, createdBy } = documents;
    const createdDocs: UserDocumentEntity[] = [];

    for (let i = 0; i < fileKeys.length; i++) {
      const doc = await this.userDocumentRepository.create(
        {
          userId,
          documentType,
          fileKey: fileKeys[i],
          fileName: fileNames?.[i] || null,
          createdBy,
        },
        entityManager,
      );
      createdDocs.push(doc);
    }

    return createdDocs;
  }

  async findAll(options: FindManyOptions<UserDocumentEntity>): Promise<UserDocumentEntity[]> {
    return await this.userDocumentRepository.findAll(options);
  }

  async update(
    identifierConditions: FindOptionsWhere<UserDocumentEntity>,
    updateData: Partial<UserDocumentEntity>,
    entityManager?: EntityManager,
  ) {
    return await this.userDocumentRepository.update(
      identifierConditions,
      updateData,
      entityManager,
    );
  }

  async delete(id: string, deletedBy: string, entityManager?: EntityManager): Promise<void> {
    await this.userDocumentRepository.delete(id, deletedBy, entityManager);
  }

  async deleteByCondition(
    conditions: FindOptionsWhere<UserDocumentEntity>,
    deletedBy: string,
    entityManager?: EntityManager,
  ): Promise<void> {
    await this.userDocumentRepository.deleteByCondition(conditions, deletedBy, entityManager);
  }
}
