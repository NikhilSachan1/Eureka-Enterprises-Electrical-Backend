import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { FilesService } from '../files.service';
import { FOLDER_NAME_PREFIX } from '../constants/files.constants';

export const ValidateAndUploadFiles = (customFolderName?: string) =>
  createParamDecorator(async (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const files = request.files;

    // Return empty object if no files provided (files are optional)
    if (!files || Object.keys(files).length === 0) {
      return {};
    }

    const userId = request.user.id;
    const folderName = customFolderName || `${FOLDER_NAME_PREFIX}${userId}`;

    const fileUploadService = new FilesService();
    const uploadedFileKeys = await fileUploadService.validateAndUploadFiles(files, folderName);

    return uploadedFileKeys;
  })();
