import { Test, TestingModule } from '@nestjs/testing';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

describe('FilesController', () => {
  let controller: FilesController;
  let filesService: jest.Mocked<FilesService>;

  beforeEach(async () => {
    const mockFilesService = {
      getDownloadFileUrl: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FilesController],
      providers: [
        {
          provide: FilesService,
          useValue: mockFilesService,
        },
      ],
    }).compile();

    controller = module.get<FilesController>(FilesController);
    filesService = module.get(FilesService);
  });

  describe('getDownloadFileUrl', () => {
    it('should return download URL for valid file key', async () => {
      const mockResponse = {
        url: 'https://example.com/file.pdf',
        key: 'test-key',
      };

      filesService.getDownloadFileUrl.mockResolvedValue(mockResponse);

      const result = await controller.getDownloadFileUrl('test-key');

      expect(result).toEqual(mockResponse);
      expect(filesService.getDownloadFileUrl).toHaveBeenCalledWith('test-key');
    });

    it('should throw error when file service fails', async () => {
      const error = new Error('File not found');
      filesService.getDownloadFileUrl.mockRejectedValue(error);

      await expect(controller.getDownloadFileUrl('invalid-key')).rejects.toThrow(error);
      expect(filesService.getDownloadFileUrl).toHaveBeenCalledWith('invalid-key');
    });
  });
});
