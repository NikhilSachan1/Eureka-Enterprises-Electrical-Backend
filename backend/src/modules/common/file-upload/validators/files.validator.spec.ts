import { BadRequestException } from '@nestjs/common';
import { validateFileUploads } from './files.validator';
import { IFileUpload } from '../files.types';
import {
  ALLOWED_MAX_FILE_SIZE,
  FILE_LIMIT,
  FILE_UPLOAD_ERRORS,
} from '../constants/files.constants';

describe('validateFileUploads', () => {
  const mockFolderName = 'test-folder';

  it('should throw an error if file limit is exceeded', () => {
    const mockFiles: IFileUpload[] = new Array(FILE_LIMIT.MAXIMUM_FILE_LIMIT + 1).fill({
      fieldname: 'profilePicture',
      mimetype: 'image',
      size: 1000,
      buffer: Buffer.from(''),
      originalname: 'test.png',
    });

    expect(() => validateFileUploads(mockFiles, mockFolderName)).toThrow(
      new BadRequestException(FILE_UPLOAD_ERRORS.MAX_FILE_LIMIT_REACHED),
    );
  });

  it('should throw an error if file type is not allowed', () => {
    const mockFiles: IFileUpload[] = [
      {
        fieldname: 'profilePicture',
        mimetype: 'image/svg',
        size: 1000,
        buffer: Buffer.from(''),
        originalname: 'test.unknown',
        encoding: 'utf-8',
      },
    ];

    expect(() => validateFileUploads(mockFiles, mockFolderName)).toThrow(
      new BadRequestException(`${FILE_UPLOAD_ERRORS.INVALID_FILE_FORMAT} for Profile Picture.`),
    );
  });

  it('should throw an error if file size exceeds the allowed limit', () => {
    const mockFiles: IFileUpload[] = [
      {
        fieldname: 'profilePicture',
        mimetype: 'image/png',
        size: ALLOWED_MAX_FILE_SIZE['image/png'] + 1,
        buffer: Buffer.from(''),
        originalname: 'test.png',
        encoding: 'utf-8',
      },
    ];

    expect(() => validateFileUploads(mockFiles, mockFolderName)).toThrow(
      new BadRequestException(FILE_UPLOAD_ERRORS.FILE_SIZE_EXCEEDED),
    );
  });

  it('should return files to be uploaded if all validations pass', () => {
    const mockFiles: IFileUpload[] = [
      {
        fieldname: 'profilePicture',
        mimetype: 'image/png',
        size: 1000,
        buffer: Buffer.from(''),
        originalname: 'test.png',
        encoding: 'utf-8',
      },
    ];

    const result = validateFileUploads(mockFiles, mockFolderName);

    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('fileStream');
    expect(result[0]).toHaveProperty('key');
    expect(result[0]).toHaveProperty('mimetype');
  });
});
