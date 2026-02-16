import { Body, Controller, Param, ParseUUIDPipe, Patch, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRoleService } from './user-role.service';
import { UpdateUserRoleDto, AssignUserRolesDto } from './dto';

@ApiTags('User Roles')
@ApiBearerAuth('JWT-auth')
@Controller('user-roles')
export class UserRoleController {
  constructor(private readonly userRoleService: UserRoleService) {}

  @Patch('user/:userId')
  @ApiOperation({
    summary: 'Assign roles to user',
    description:
      'Assigns multiple roles to a user. This replaces all existing roles with the new ones. A user can have one or more roles.',
  })
  async assignRolesToUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() assignUserRolesDto: AssignUserRolesDto,
    @Request() { user: { id: assignedBy } }: { user: { id: string } },
  ) {
    return await this.userRoleService.assignRolesToUser(userId, assignUserRolesDto, assignedBy);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update user role',
    description: 'Updates a single user-role record by its ID.',
  })
  async update(
    @Param('id') id: string,
    @Body() updateUserRoleDto: UpdateUserRoleDto,
    @Request() { user: { id: deletedBy } }: { user: { id: string } },
  ) {
    return await this.userRoleService.updateUserRole(id, updateUserRoleDto, deletedBy);
  }
}
