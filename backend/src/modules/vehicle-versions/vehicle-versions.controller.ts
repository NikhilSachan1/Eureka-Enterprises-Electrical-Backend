import { Controller, Get, Param, Query } from '@nestjs/common';
import { VehicleVersionsService } from './vehicle-versions.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { VehicleVersionsQueryDto } from './dto';

@ApiTags('Vehicle Events')
@ApiBearerAuth('JWT-auth')
@Controller('vehicle-events')
export class VehicleVersionsController {
  constructor(private readonly vehicleVersionsService: VehicleVersionsService) {}

  @Get(':vehicleMasterId')
  async findAll(
    @Param('vehicleMasterId') vehicleMasterId: string,
    @Query() query: VehicleVersionsQueryDto,
  ) {
    return await this.vehicleVersionsService.findAll({
      where: {
        vehicleMasterId,
      },
      ...query,
    });
  }
}
