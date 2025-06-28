import { Controller, Post, Delete, Body, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { RolePermissionService } from './role-permission.service';
import {
  CreateRolePermissionDto,
  BulkCreateRolePermissionsDto,
  DeleteRolePermissionDto,
  BulkDeleteRolePermissionsDto,
} from './dto';

@ApiTags('Role Permissions')
@ApiBearerAuth('JWT-auth')
@Controller('role-permissions')
export class RolePermissionController {
  constructor(private readonly rolePermissionService: RolePermissionService) {}

  @Post()
  async create(@Body() createRolePermissionDto: CreateRolePermissionDto) {
    return await this.rolePermissionService.create(createRolePermissionDto);
  }

  @Post('bulk')
  async bulkCreate(@Body() bulkCreateDto: BulkCreateRolePermissionsDto) {
    return await this.rolePermissionService.bulkCreate(bulkCreateDto);
  }

  @Delete()
  async delete(
    @Body() deleteRolePermissionDto: DeleteRolePermissionDto,
    @Request() { user: { id: userId } }: { user: { id: string } },
  ) {
    return await this.rolePermissionService.delete(deleteRolePermissionDto, userId);
  }

  @Delete('bulk')
  async bulkDelete(
    @Body() bulkDeleteDto: BulkDeleteRolePermissionsDto,
    @Request() { user: { id: userId } }: { user: { id: string } },
  ) {
    return await this.rolePermissionService.bulkDelete(bulkDeleteDto, userId);
  }
}
