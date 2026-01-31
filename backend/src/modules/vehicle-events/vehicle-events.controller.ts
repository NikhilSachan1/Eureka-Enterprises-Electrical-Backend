import { Controller, Get, Param, Query, Request } from '@nestjs/common';
import { VehicleEventsService } from './vehicle-events.service';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { VehicleEventsQueryDto } from './dto/vehicle-events-query.dto';

interface RequestWithTimezone extends Request {
  timezone: string;
}

@ApiTags('Vehicle Events')
@ApiBearerAuth('JWT-auth')
@Controller('vehicle-events')
export class VehicleEventsController {
  constructor(private readonly vehicleEventsService: VehicleEventsService) {}

  @Get(':vehicleMasterId')
  @ApiOperation({
    summary: 'Get vehicle events',
    description:
      'Retrieves all events associated with a specific vehicle, filtered by query parameters.',
  })
  async findAll(
    @Request() req: RequestWithTimezone,
    @Param('vehicleMasterId') vehicleMasterId: string,
    @Query() query: VehicleEventsQueryDto,
  ) {
    return await this.vehicleEventsService.findAll(vehicleMasterId, query, req.timezone);
  }
}
