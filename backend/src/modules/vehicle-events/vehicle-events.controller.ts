import { Controller } from '@nestjs/common';
import { VehicleEventsService } from './vehicle-events.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Vehicle Events')
@ApiBearerAuth('JWT-auth')
@Controller('vehicle-events')
export class VehicleEventsController {
  constructor(private readonly vehicleEventsService: VehicleEventsService) {}
}
