import { Body, Controller, Param, Patch, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRoleService } from './user-role.service';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';

@ApiTags('User Roles')
@ApiBearerAuth('JWT-auth')
@Controller('user-roles')
export class UserRoleController {
  constructor(private readonly userRoleService: UserRoleService) {}

  @Patch(':id')
  @ApiOperation({
    summary: 'Update user role',
    description: 'Updates the roles assigned to a specific user.',
  })
  async update(
    @Param('id') id: string,
    @Body() updateUserRoleDto: UpdateUserRoleDto,
    @Request() { user: { id: deletedBy } }: { user: { id: string } },
  ) {
    return await this.userRoleService.updateUserRole(id, updateUserRoleDto, deletedBy);
  }
}
