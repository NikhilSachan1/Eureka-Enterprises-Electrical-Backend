import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateJmcDto } from './create-jmc.dto';

export class UpdateJmcDto extends PartialType(OmitType(CreateJmcDto, ['poId'] as const)) {}
