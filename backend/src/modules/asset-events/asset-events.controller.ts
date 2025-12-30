import { Controller, Get, Param, Query, Request } from '@nestjs/common';
import { AssetEventsService } from './asset-events.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AssetEventsQueryDto } from './dto/asset-events-query.dto';
import { RequestWithTimezone } from './asset-events.types';

@ApiTags('Asset Events')
@ApiBearerAuth('JWT-auth')
@Controller('asset-events')
export class AssetEventsController {
  constructor(private readonly assetEventsService: AssetEventsService) {}

  @Get(':assetMasterId')
  async findAll(
    @Request() req: RequestWithTimezone,
    @Param('assetMasterId') assetMasterId: string,
    @Query() query: AssetEventsQueryDto,
  ) {
    return await this.assetEventsService.findAll(assetMasterId, query, req.timezone);
  }
}
