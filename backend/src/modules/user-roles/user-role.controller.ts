import { Controller } from '@nestjs/common';
import { UserRoleService } from './user-role.service';

@Controller('user-roles')
export class UserRoleController {
  constructor(private readonly userRoleService: UserRoleService) {}
}
