import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, S3 } from '@aws-sdk/client-s3';
import { Environments } from '../../../../env-configs';
import { validateFileUploads } from './validators/files.validator';
import { DATABASE_FIELD_NAMES, FILE_ERRORS } from './constants/files.constants';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class FilesService {
  private readonly s3: S3;
  private readonly bucketName: string;

  constructor() {
    this.s3 = new S3({
      region: Environments.AWS_S3_REGION,
      credentials: {
        accessKeyId: Environments.AWS_S3_ACCESS_KEY,
        secretAccessKey: Environments.AWS_S3_SECRET_KEY,
      },
    });
    if (this.s3) {
      Logger.log('S3 instance has been set up.');
    } else {
      Logger.error('S3 instance has not been set up.');
    }

    this.bucketName = Environments.AWS_S3_BUCKET_NAME;
  }

  async validateAndUploadFiles(
    files: { [fieldname: string]: Express.Multer.File[] },
    folderName: string,
  ): Promise<{ [key: string]: string | string[] }> {
    const uploadedFileKeys: { [key: string]: string | string[] } = {};

    for (const fieldname in files) {
      const dbAttribute = DATABASE_FIELD_NAMES[fieldname];
      const filesToBeUploaded = validateFileUploads(files[fieldname], folderName);
      const fileKeys: string[] = await Promise.all(
        filesToBeUploaded.map(async (file) => {
          const filePath = await this.uploadFile(file.fileStream, file.key, file.mimetype);
          return filePath;
        }),
      );
      uploadedFileKeys[dbAttribute] = fileKeys.length === 1 ? [fileKeys[0]] : fileKeys;
    }
    return uploadedFileKeys;
  }

  async uploadFile(fileStream: Buffer, key: string, mimetype: string): Promise<string> {
    const params = {
      Bucket: this.bucketName,
      Key: key,
      Body: fileStream,
      ContentType: mimetype,
    };

    try {
      await this.s3.putObject(params);
      return key;
    } catch (error) {
      throw new InternalServerErrorException(`${FILE_ERRORS.UPLOAD} ${error.message}`);
    }
  }

  async getDownloadFileUrl(key: string): Promise<{ url: string; key: string }> {
    const params = {
      Bucket: this.bucketName,
      Key: key,
    };

    try {
      // First, check if the file exists in S3 using HeadObjectCommand
      const headCommand = new HeadObjectCommand(params);
      await this.s3.send(headCommand);

      // If file exists, generate the presigned URL
      const command = new GetObjectCommand(params);
      const preSignedUrl = await getSignedUrl(this.s3, command);
      return { url: preSignedUrl, key };
    } catch (error) {
      // If the error is "NotFound" or "NoSuchKey", the file doesn't exist
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        throw new NotFoundException(FILE_ERRORS.FILE_NOT_FOUND);
      }
      throw new NotFoundException(`${FILE_ERRORS.GET} ${error.message}`);
    }
  }

  async getFileContent(fileKey: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
      });

      const response = await this.s3.send(command);

      if (response.Body) {
        return Buffer.from(await response.Body.transformToByteArray());
      } else {
        Logger.error('Response body is empty');
      }
    } catch (error) {
      throw new Error(`${FILE_ERRORS.GET} ${error.message}`);
    }
  }

  async getS3Url(fileKey: string): Promise<string> {
    try {
      return `s3://${this.bucketName}/${fileKey}`;
    } catch (error) {
      throw new Error(`${FILE_ERRORS.GENERATE_S3_URL} ${error.message}`);
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: key,
      };

      const command = new DeleteObjectCommand(params);
      await this.s3.send(command);

      Logger.log(`Successfully deleted file: ${key}`);
    } catch (error) {
      Logger.error(`Failed to delete file ${key}:`, error);
      throw new Error(`${FILE_ERRORS.DELETE} ${error.message}`);
    }
  }
}
