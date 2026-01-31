import { Controller, Get, Param, Query } from '@nestjs/common';
import { VehicleVersionsService } from './vehicle-versions.service';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { VehicleVersionsQueryDto } from './dto';
import { SortOrder } from 'src/utils/utility/constants/utility.constants';

@ApiTags('Vehicle Versions')
@ApiBearerAuth('JWT-auth')
@Controller('vehicle-versions')
export class VehicleVersionsController {
  constructor(private readonly vehicleVersionsService: VehicleVersionsService) {}

  @Get(':vehicleMasterId')
  @ApiOperation({
    summary: 'Get vehicle versions',
    description: 'Retrieves all versions/history records for a specific vehicle master record.',
  })
  async findAll(
    @Param('vehicleMasterId') vehicleMasterId: string,
    @Query() query: VehicleVersionsQueryDto,
  ) {
    return await this.vehicleVersionsService.findAll({
      where: {
        vehicleMasterId,
      },
      ...query,
      order: {
        createdAt: SortOrder.DESC,
      },
    });
  }
}
