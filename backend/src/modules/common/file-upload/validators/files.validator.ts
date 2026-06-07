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

/**
 * @param uploadedFiles  Files to validate and prepare for S3 upload.
 * @param folderName     S3 folder prefix.
 * @param maxSizeOverride  Optional: flat size limit (bytes) applied to ALL
 *                         mime types for this call, overriding the global
 *                         per-mime limits. Useful for endpoints that allow
 *                         a higher ceiling (e.g. site-report-upload = 50 MB).
 */
export const validateFileUploads = (
  uploadedFiles: IFileUpload[],
  folderName: string,
  maxSizeOverride?: number,
) => {
  const filesToBeUploaded = [];

  if (uploadedFiles.length > FILE_LIMIT.MAXIMUM_FILE_LIMIT) {
    throw new BadRequestException(FILE_UPLOAD_ERRORS.MAX_FILE_LIMIT_REACHED);
  }

  for (const uploadedFile of uploadedFiles) {
    const { fieldname, mimetype, size, buffer, originalname } = uploadedFile;
    const allowedFormats = FIELD_FORMATS[fieldname];
    const fieldDisplayName = FIELD_NAME_REFORMED[fieldname] || fieldname;

    if (!ALLOWED_FILE_TYPES.includes(mimetype)) {
      throw new BadRequestException(
        `${FILE_UPLOAD_ERRORS.INVALID_FILE_FORMAT} for ${fieldDisplayName}`,
      );
    }

    if (
      !allowedFormats ||
      !allowedFormats.some((format) =>
        ALLOWED_MIME_TYPES[format]?.some((type) => mimetype.startsWith(type)),
      )
    ) {
      throw new BadRequestException(
        `${FILE_UPLOAD_ERRORS.INVALID_FILE_FORMAT} for ${fieldDisplayName}`,
      );
    }

    // Use override limit if provided, otherwise fall back to per-mime global limit
    const effectiveMaxSize = maxSizeOverride ?? ALLOWED_MAX_FILE_SIZE[mimetype];
    if (effectiveMaxSize && size > effectiveMaxSize) {
      throw new BadRequestException(FILE_UPLOAD_ERRORS.FILE_SIZE_EXCEEDED);
    }

    const key = `${folderName}/${new Date().getTime()}_${originalname.replace(/_/g, '-')}`;
    filesToBeUploaded.push({ fileStream: buffer, key, mimetype });
  }

  return filesToBeUploaded;
};
