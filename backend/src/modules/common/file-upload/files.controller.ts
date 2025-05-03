import { Controller, Get, Query } from '@nestjs/common';
import { FilesService } from './files.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Files')
@Controller('files')
@ApiBearerAuth('JWT-auth')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get()
  async getDownloadFileUrl(@Query('key') key: string) {
    return await this.filesService.getDownloadFileUrl(key);
  }
}
