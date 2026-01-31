import { Controller, Get, Param, Query } from '@nestjs/common';
import { AssetVersionsService } from './asset-versions.service';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { AssetVersionsQueryDto } from './dto';

@ApiTags('Asset Versions')
@ApiBearerAuth('JWT-auth')
@Controller('asset-versions')
export class AssetVersionsController {
  constructor(private readonly assetVersionsService: AssetVersionsService) {}

  @Get(':assetMasterId')
  @ApiOperation({
    summary: 'Get asset versions',
    description:
      'Retrieves all versions of a specific asset by asset master ID. Supports query parameters for filtering and pagination.',
  })
  async findAll(
    @Param('assetMasterId') assetMasterId: string,
    @Query() query: AssetVersionsQueryDto,
  ) {
    return await this.assetVersionsService.findAll({
      where: {
        assetMasterId,
      },
      ...query,
    });
  }
}
