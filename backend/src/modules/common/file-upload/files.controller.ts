import { Controller, Get, Query } from '@nestjs/common';
import { FilesService } from './files.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Files')
@Controller('files')
@ApiBearerAuth('JWT-auth')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get()
  @ApiOperation({
    summary: 'Get file download URL',
    description:
      'Retrieves a signed download URL for a file stored in the system using the file key.',
  })
  async getDownloadFileUrl(@Query('key') key: string) {
    return await this.filesService.getDownloadFileUrl(key);
  }
}
