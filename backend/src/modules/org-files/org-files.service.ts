import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FilesService } from 'src/modules/common/file-upload/files.service';
import { UtilityService } from 'src/utils/utility/utility.service';
import { OrgFilesRepository } from './org-files.repository';
import { CreateFolderDto, GetOrgFilesDto, MoveNodeDto, RenameNodeDto } from './dto';
import {
  ORG_FILE_ERRORS,
  ORG_FILE_RESPONSES,
  OrgFileNodeType,
} from './constants/org-files.constants';
import {
  buildBreadcrumbQuery,
  buildDescendantFolderIdsQuery,
  buildDescendantIdsQuery,
  buildListOrgFilesQuery,
} from './queries/org-files.queries';

@Injectable()
export class OrgFilesService {
  constructor(
    private readonly orgFilesRepository: OrgFilesRepository,
    private readonly filesService: FilesService,
    private readonly utilityService: UtilityService,
  ) {}

  async listContents(filters: GetOrgFilesDto) {
    const { query, countQuery, params, countParams } = buildListOrgFilesQuery(filters);

    const [records, countResult] = await Promise.all([
      this.orgFilesRepository.executeRawQuery(query, params),
      this.orgFilesRepository.executeRawQuery(countQuery, countParams),
    ]);

    const totalRecords = parseInt(countResult[0]?.total ?? '0', 10);
    return this.utilityService.listResponse(records, totalRecords);
  }

  async createFolder(dto: CreateFolderDto, userId: string) {
    if (dto.parentId) {
      await this.validateParentIsFolder(dto.parentId);
    }

    const folder = await this.orgFilesRepository.create({
      name: dto.name,
      type: OrgFileNodeType.FOLDER,
      parentId: dto.parentId ?? null,
      storageKey: null,
      mimeType: null,
      size: null,
      createdBy: userId,
      updatedBy: userId,
    });

    return { message: ORG_FILE_RESPONSES.FOLDER_CREATED, data: folder };
  }

  async uploadFile(
    uploadedFile: { storageKey: string; mimeType: string; size: number },
    parentId: string | undefined,
    fileName: string,
    userId: string,
  ) {
    if (parentId) {
      await this.validateParentIsFolder(parentId);
    }

    const node = await this.orgFilesRepository.create({
      name: fileName,
      type: OrgFileNodeType.FILE,
      parentId: parentId ?? null,
      storageKey: uploadedFile.storageKey,
      mimeType: uploadedFile.mimeType,
      size: uploadedFile.size,
      createdBy: userId,
      updatedBy: userId,
    });

    return { message: ORG_FILE_RESPONSES.FILE_UPLOADED, data: node };
  }

  async rename(id: string, dto: RenameNodeDto, userId: string) {
    await this.findNodeOrFail(id);

    await this.orgFilesRepository.update({ id }, { name: dto.name, updatedBy: userId });

    return { message: ORG_FILE_RESPONSES.RENAMED };
  }

  async move(id: string, dto: MoveNodeDto, userId: string) {
    const node = await this.findNodeOrFail(id);

    const newParentId = dto.parentId ?? null;

    if (newParentId) {
      await this.validateParentIsFolder(newParentId);

      if (node.type === OrgFileNodeType.FOLDER) {
        await this.ensureNotMovingIntoDescendant(id, newParentId);
      }
    }

    await this.orgFilesRepository.update({ id }, { parentId: newParentId, updatedBy: userId });

    return { message: ORG_FILE_RESPONSES.MOVED };
  }

  async remove(id: string, userId: string) {
    const node = await this.findNodeOrFail(id);

    if (node.type === OrgFileNodeType.FOLDER) {
      await this.deleteFolderRecursive(id, userId);
    } else {
      await this.deleteFileNode(node.id, node.storageKey, userId);
    }

    return { message: ORG_FILE_RESPONSES.DELETED };
  }

  async getBreadcrumb(id: string) {
    await this.findNodeOrFail(id);

    const { query, params } = buildBreadcrumbQuery(id);
    const breadcrumb = await this.orgFilesRepository.executeRawQuery(query, params);

    return { message: ORG_FILE_RESPONSES.FETCHED, data: breadcrumb };
  }

  async getDownloadUrl(id: string) {
    const node = await this.findNodeOrFail(id);

    if (node.type === OrgFileNodeType.FOLDER) {
      throw new BadRequestException('Cannot download a folder.');
    }

    const result = await this.filesService.getDownloadFileUrl(node.storageKey);
    return { message: ORG_FILE_RESPONSES.FETCHED, data: result };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async findNodeOrFail(id: string) {
    const node = await this.orgFilesRepository.findOne({ where: { id } });
    if (!node) throw new NotFoundException(ORG_FILE_ERRORS.NOT_FOUND);
    return node;
  }

  private async validateParentIsFolder(parentId: string) {
    const parent = await this.orgFilesRepository.findOne({ where: { id: parentId } });
    if (!parent) throw new NotFoundException(ORG_FILE_ERRORS.PARENT_NOT_FOUND);
    if (parent.type !== OrgFileNodeType.FOLDER) {
      throw new BadRequestException(ORG_FILE_ERRORS.PARENT_MUST_BE_FOLDER);
    }
  }

  private async ensureNotMovingIntoDescendant(folderId: string, targetParentId: string) {
    const { query, params } = buildDescendantFolderIdsQuery(folderId);
    const descendants: { id: string }[] = await this.orgFilesRepository.executeRawQuery(
      query,
      params,
    );
    const descendantIds = descendants.map((d) => d.id);
    if (descendantIds.includes(targetParentId)) {
      throw new BadRequestException(ORG_FILE_ERRORS.CANNOT_MOVE_INTO_SELF);
    }
  }

  private async deleteFolderRecursive(folderId: string, userId: string) {
    const { query, params } = buildDescendantIdsQuery(folderId);
    const descendants: { id: string; type: string; storageKey: string | null }[] =
      await this.orgFilesRepository.executeRawQuery(query, params);

    const s3DeletePromises = descendants
      .filter((d) => d.type === OrgFileNodeType.FILE && d.storageKey)
      .map((d) => this.filesService.deleteFile(d.storageKey));

    await Promise.all(s3DeletePromises);

    const descendantIds = descendants.map((d) => d.id);
    for (const descendantId of descendantIds) {
      await this.orgFilesRepository.update({ id: descendantId }, { deletedBy: userId });
      await this.orgFilesRepository.softDelete({ id: descendantId });
    }

    await this.orgFilesRepository.update({ id: folderId }, { deletedBy: userId });
    await this.orgFilesRepository.softDelete({ id: folderId });
  }

  private async deleteFileNode(id: string, storageKey: string | null, userId: string) {
    if (storageKey) {
      await this.filesService.deleteFile(storageKey);
    }
    await this.orgFilesRepository.update({ id }, { deletedBy: userId });
    await this.orgFilesRepository.softDelete({ id });
  }
}
