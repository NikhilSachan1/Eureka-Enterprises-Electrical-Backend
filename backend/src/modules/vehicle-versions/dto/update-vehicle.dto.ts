import { PartialType } from '@nestjs/mapped-types';
import { CreateVehicleVersionDto } from './create-vehicle.dto';

export class UpdateVehicleVersionDto extends PartialType(CreateVehicleVersionDto) {}
