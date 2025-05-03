import { BadRequestException } from '@nestjs/common';
import {
  ALLOWED_FILE_TYPES,
  ALLOWED_MAX_FILE_SIZE,
  FIELD_NAME_REFORMED,
  FIELD_FORMATS,
  FILE_LIMIT,
  FILE_UPLOAD_ERRORS,
  ALLOWED_MIME_TYPES,
} from '../constants/files.constants';
import { IFileUpload } from '../files.types';

export const validateFileUploads = (uploadedFiles: IFileUpload[], folderName: string) => {
  const filesToBeUploaded = [];

  if (uploadedFiles.length > FILE_LIMIT.MAXIMUM_FILE_LIMIT) {
    throw new BadRequestException(FILE_UPLOAD_ERRORS.MAX_FILE_LIMIT_REACHED);
  }

  for (const uploadedFile of uploadedFiles) {
    const { fieldname, mimetype, size, buffer, originalname } = uploadedFile;
    const allowedFormats = FIELD_FORMATS[fieldname];

    if (!ALLOWED_FILE_TYPES.includes(mimetype)) {
      throw new BadRequestException(
        `${FILE_UPLOAD_ERRORS.INVALID_FILE_FORMAT} for ${FIELD_NAME_REFORMED[fieldname]}`,
      );
    }

    if (
      !allowedFormats.some((format) =>
        ALLOWED_MIME_TYPES[format].some((type) => mimetype.startsWith(type)),
      )
    ) {
      throw new BadRequestException(
        `${FILE_UPLOAD_ERRORS.INVALID_FILE_FORMAT} for ${FIELD_NAME_REFORMED[fieldname]}`,
      );
    }

    if (ALLOWED_MAX_FILE_SIZE[mimetype] && size > ALLOWED_MAX_FILE_SIZE[mimetype]) {
      throw new BadRequestException(FILE_UPLOAD_ERRORS.FILE_SIZE_EXCEEDED);
    }

    const key = `${folderName}/${new Date().getTime()}_${originalname.replace(/_/g, '-')}`;
    filesToBeUploaded.push({ fileStream: buffer, key, mimetype });
  }

  return filesToBeUploaded;
};
