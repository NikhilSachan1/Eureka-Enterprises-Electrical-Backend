import { Body, Controller, Param, Patch } from '@nestjs/common';
import { UserRoleService } from './user-role.service';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';

@Controller('user-roles')
export class UserRoleController {
  constructor(private readonly userRoleService: UserRoleService) {}

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateUserRoleDto: UpdateUserRoleDto) {
    return await this.userRoleService.updateUserRole(id, updateUserRoleDto);
  }
}
