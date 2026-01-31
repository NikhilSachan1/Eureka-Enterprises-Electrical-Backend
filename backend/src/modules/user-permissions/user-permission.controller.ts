import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Request,
  UseInterceptors,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserPermissionService } from './user-permission.service';
import {
  BulkDeleteUserPermissionsDto,
  BulkCreateUserPermissionsDto,
  GetUserPermissionStatsDto,
  GetUserPermissionDto,
} from './dto';
import { UserPermissionUserIdInterceptor } from './interceptors/user-permission-userid.interceptor';

@ApiTags('User Permissions')
@ApiBearerAuth('JWT-auth')
@Controller('user-permissions')
export class UserPermissionController {
  constructor(private readonly userPermissionService: UserPermissionService) {}

  @Post('bulk')
  @ApiOperation({
    summary: 'Bulk create user permissions',
    description: 'Creates multiple user permissions at once for one or more users.',
  })
  async bulkCreate(@Body() bulkCreateUserPermissionDto: BulkCreateUserPermissionsDto) {
    return await this.userPermissionService.bulkCreate(bulkCreateUserPermissionDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get user permissions',
    description: 'Retrieves user permissions filtered by user ID, role ID, and active status.',
  })
  @UseInterceptors(UserPermissionUserIdInterceptor)
  async getUserPermissions(@Query() { userId, roleId, isActive }: GetUserPermissionDto) {
    return await this.userPermissionService.getUserPermissions(userId, roleId, isActive);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get user permission statistics',
    description: 'Retrieves statistics about user permissions including counts and user details.',
  })
  async getUserPermissionStats(@Query() options: GetUserPermissionStatsDto) {
    return await this.userPermissionService.findAllUsersWithPermissionStats(options);
  }

  @Delete('bulk')
  @ApiOperation({
    summary: 'Bulk delete user permissions',
    description: 'Deletes multiple user permissions at once based on provided permission IDs.',
  })
  async bulkDelete(
    @Body() bulkDeleteDto: BulkDeleteUserPermissionsDto,
    @Request() { user: { id: userId } }: { user: { id: string } },
  ) {
    return await this.userPermissionService.bulkDelete(bulkDeleteDto, userId);
  }
}
