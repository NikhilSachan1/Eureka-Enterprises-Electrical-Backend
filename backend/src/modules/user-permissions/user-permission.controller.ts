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
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
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
  async bulkCreate(@Body() bulkCreateUserPermissionDto: BulkCreateUserPermissionsDto) {
    return await this.userPermissionService.bulkCreate(bulkCreateUserPermissionDto);
  }

  @Get()
  @UseInterceptors(UserPermissionUserIdInterceptor)
  async getUserPermissions(@Query() { userId, roleId, isActive }: GetUserPermissionDto) {
    return await this.userPermissionService.getUserPermissions(userId, roleId, isActive);
  }

  @Get('stats')
  async getUserPermissionStats(@Query() options: GetUserPermissionStatsDto) {
    return await this.userPermissionService.findAllUsersWithPermissionStats(options);
  }

  @Delete('bulk')
  async bulkDelete(
    @Body() bulkDeleteDto: BulkDeleteUserPermissionsDto,
    @Request() { user: { id: userId } }: { user: { id: string } },
  ) {
    return await this.userPermissionService.bulkDelete(bulkDeleteDto, userId);
  }
}
