import { Controller, Post, Get, Delete, Put, Body, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserPermissionService } from './user-permission.service';
import {
  CreateUserPermissionDto,
  DeleteUserPermissionDto,
  BulkDeleteUserPermissionsDto,
  BulkUpdateUserPermissionDto,
} from './dto';

@ApiTags('User Permissions')
@ApiBearerAuth('JWT-auth')
@Controller('user-permissions')
export class UserPermissionController {
  constructor(private readonly userPermissionService: UserPermissionService) {}

  @Post()
  async create(@Body() createUserPermissionDto: CreateUserPermissionDto) {
    return await this.userPermissionService.create(createUserPermissionDto);
  }

  @Get()
  async getUserPermissions(@Request() { user: { id: userId } }: { user: { id: string } }) {
    return await this.userPermissionService.getUserPermissions(userId);
  }

  @Delete()
  async delete(
    @Body() deleteUserPermissionDto: DeleteUserPermissionDto,
    @Request() { user: { id: userId } }: { user: { id: string } },
  ) {
    return await this.userPermissionService.delete(deleteUserPermissionDto, userId);
  }

  @Delete('bulk')
  async bulkDelete(
    @Body() bulkDeleteDto: BulkDeleteUserPermissionsDto,
    @Request() { user: { id: userId } }: { user: { id: string } },
  ) {
    return await this.userPermissionService.bulkDelete(bulkDeleteDto, userId);
  }

  @Put('bulk')
  async bulkUpdate(
    @Body() bulkUpdateDto: BulkUpdateUserPermissionDto,
    @Request() { user: { id: userId } }: { user: { id: string } },
  ) {
    return await this.userPermissionService.bulkUpdate(bulkUpdateDto, userId);
  }
}
