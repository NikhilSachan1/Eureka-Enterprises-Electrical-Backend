import { BadRequestException, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { FilesService } from '../files.service';
import { FILE_UPLOAD_ERRORS, FOLDER_NAME_PREFIX } from '../constants/files.constants';

export const ValidateAndUploadFiles = (customFolderName?: string) =>
  createParamDecorator(async (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const files = request.files;

    if (!files) throw new BadRequestException(FILE_UPLOAD_ERRORS.NO_FILE_UPLOADED);

    const userId = request.user.id;
    const folderName = customFolderName || `${FOLDER_NAME_PREFIX}${userId}`;

    const fileUploadService = new FilesService();
    const uploadedFileKeys = await fileUploadService.validateAndUploadFiles(files, folderName);

    return uploadedFileKeys;
  })();
