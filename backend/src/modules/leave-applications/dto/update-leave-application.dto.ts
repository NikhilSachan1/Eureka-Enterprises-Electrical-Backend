import { PartialType } from '@nestjs/swagger';
import { CreateLeaveApplicationDto } from './create-leave-application.dto';

export class UpdateLeaveApplicationDto extends PartialType(CreateLeaveApplicationDto) {}
