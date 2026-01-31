import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from 'src/modules/auth/decorators/public.decorator';

@ApiTags('Health Check')
@Public()
@Controller('/health-check')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({
    summary: 'Health check',
    description: 'Returns a simple message to verify the API is running and healthy.',
  })
  getHello(): { message: string } {
    return this.appService.getHello();
  }
}
