import { Controller, Get, Param, Query } from '@nestjs/common';
import { AssetVersionsService } from './asset-versions.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AssetVersionsQueryDto } from './dto';

@ApiTags('Asset Versions')
@ApiBearerAuth('JWT-auth')
@Controller('asset-versions')
export class AssetVersionsController {
  constructor(private readonly assetVersionsService: AssetVersionsService) {}

  @Get(':assetMasterId')
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
