import { Controller, Get, Param, Query } from '@nestjs/common';
import { VehicleEventsService } from './vehicle-events.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { VehicleEventsQueryDto } from './dto/vehicle-events-query.dto';

@ApiTags('Vehicle Events')
@ApiBearerAuth('JWT-auth')
@Controller('vehicle-events')
export class VehicleEventsController {
  constructor(private readonly vehicleEventsService: VehicleEventsService) {}

  @Get(':vehicleMasterId')
  async findAll(
    @Param('vehicleMasterId') vehicleMasterId: string,
    @Query() query: VehicleEventsQueryDto,
  ) {
    return await this.vehicleEventsService.findAll(vehicleMasterId, query);
  }
}
