import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { PublicInfoService } from './public-info.service';

@ApiTags('Public')
@Controller('public')
export class PublicInfoController {
  constructor(private readonly publicInfoService: PublicInfoService) {}

  @Public()
  @Get('hr-contact')
  @ApiOperation({
    summary: 'Get HR contact info (public)',
    description:
      'Returns HR email addresses for the "Contact HR" action. No authentication or headers required. ' +
      'Returns an empty hrEmails array when not configured — the client should hide the button in that case.',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        hrEmails: { type: 'array', items: { type: 'string' }, example: ['hr@company.com'] },
      },
    },
  })
  async getHrContact() {
    return await this.publicInfoService.getHrContact();
  }
}
