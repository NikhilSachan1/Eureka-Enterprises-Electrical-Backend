import { Test, TestingModule } from '@nestjs/testing';
import { FilesService } from './files.service';
import { S3, GetObjectCommand } from '@aws-sdk/client-s3';
import { InternalServerErrorException, NotFoundException, Logger } from '@nestjs/common';
import { DATABASE_FIELD_NAMES } from './constants/files.constants';
import * as fileValidator from './validators/files.validator';
import * as presigner from '@aws-sdk/s3-request-presigner';

jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');

jest.mock('./validators/files.validator', () => ({
  validateFileUploads: jest.fn(),
}));

describe('FilesService', () => {
  let service: FilesService;
  let mockS3: jest.Mocked<S3>;

  beforeEach(async () => {
    jest.clearAllMocks();

    (presigner.getSignedUrl as jest.Mock).mockResolvedValue('mock-signed-url');

    const module: TestingModule = await Test.createTestingModule({
      providers: [FilesService],
    }).compile();

    service = module.get<FilesService>(FilesService);
    mockS3 = service['s3'] as jest.Mocked<S3>;
  });

  describe('validateAndUploadFiles', () => {
    it('should successfully upload single file and return correct key', async () => {
      const mockFiles = {
        profilePicture: [
          {
            fieldname: 'profilePicture',
            originalname: 'test.jpg',
            buffer: Buffer.from('test'),
            mimetype: 'image/jpeg',
          },
        ] as Express.Multer.File[],
      };

      (fileValidator.validateFileUploads as jest.Mock).mockReturnValue([
        {
          fileStream: Buffer.from('test'),
          key: 'uploads/test.jpg',
          mimetype: 'image/jpeg',
        },
      ]);

      mockS3.putObject.mockResolvedValue({} as never);

      const result = await service.validateAndUploadFiles(mockFiles, 'uploads');

      expect(result).toEqual({
        [DATABASE_FIELD_NAMES.profilePicture]: 'uploads/test.jpg',
      });
    });

    it('should successfully upload multiple files and return array of keys', async () => {
      const mockFiles = {
        document: [
          {
            fieldname: 'documents',
            originalname: 'doc1.pdf',
            buffer: Buffer.from('test1'),
            mimetype: 'application/pdf',
          },
          {
            fieldname: 'documents',
            originalname: 'doc2.pdf',
            buffer: Buffer.from('test2'),
            mimetype: 'application/pdf',
          },
        ] as Express.Multer.File[],
      };

      (fileValidator.validateFileUploads as jest.Mock).mockReturnValue([
        {
          fileStream: Buffer.from('test1'),
          key: 'uploads/doc1.pdf',
          mimetype: 'application/pdf',
        },
        {
          fileStream: Buffer.from('test2'),
          key: 'uploads/doc2.pdf',
          mimetype: 'application/pdf',
        },
      ]);

      mockS3.putObject.mockResolvedValue({} as never);

      const result = await service.validateAndUploadFiles(mockFiles, 'uploads');

      expect(result).toEqual({
        [DATABASE_FIELD_NAMES.document]: ['uploads/doc1.pdf', 'uploads/doc2.pdf'],
      });
    });
  });

  describe('uploadFile', () => {
    it('should successfully upload a file to S3', async () => {
      mockS3.putObject.mockResolvedValue({} as never);

      const result = await service.uploadFile(Buffer.from('test'), 'test-key', 'image/jpeg');

      expect(result).toBe('test-key');
      expect(mockS3.putObject).toHaveBeenCalledWith({
        Bucket: expect.any(String),
        Key: 'test-key',
        Body: expect.any(Buffer),
        ContentType: 'image/jpeg',
      });
    });

    it('should throw InternalServerErrorException when upload fails', async () => {
      mockS3.putObject.mockRejectedValue(new Error('Upload failed') as unknown as never);

      await expect(
        service.uploadFile(Buffer.from('test'), 'test-key', 'image/jpeg'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getDownloadFileUrl', () => {
    it('should return pre-signed URL for valid key', async () => {
      const result = await service.getDownloadFileUrl('test-key');

      expect(presigner.getSignedUrl).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(GetObjectCommand),
      );

      expect(result).toEqual({
        url: 'mock-signed-url',
        key: 'test-key',
      });
    });

    it('should throw NotFoundException when file not found', async () => {
      (presigner.getSignedUrl as jest.Mock).mockRejectedValueOnce(new Error('File not found'));

      await expect(service.getDownloadFileUrl('invalid-key')).rejects.toThrow(NotFoundException);
    });
  });
});

describe('FilesService Constructor', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    jest.spyOn(Logger, 'log').mockImplementation(jest.fn());
    jest.spyOn(Logger, 'error').mockImplementation(jest.fn());
  });

  it('should log error when S3 instance is not set up', () => {
    (S3 as jest.Mock).mockImplementation(() => {
      Logger.error('S3 instance has not been set up.');
      return {};
    });

    void new FilesService();

    expect(Logger.error).toHaveBeenCalledWith('S3 instance has not been set up.');
  });

  it('should log success when S3 instance is properly set up', () => {
    (S3 as jest.Mock).mockImplementation(() => ({}));

    void new FilesService();

    expect(Logger.log).toHaveBeenCalledWith('S3 instance has been set up.');
    expect(Logger.error).not.toHaveBeenCalled();
  });
});
