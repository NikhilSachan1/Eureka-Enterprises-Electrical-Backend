import { Controller, Post, Delete, Body, Request, Query, Get } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { RolePermissionService } from './role-permission.service';
import {
  BulkCreateRolePermissionsDto,
  BulkDeleteRolePermissionsDto,
  GetAllRolePermissionDto,
} from './dto';

@ApiTags('Role Permissions')
@ApiBearerAuth('JWT-auth')
@Controller('role-permissions')
export class RolePermissionController {
  constructor(private readonly rolePermissionService: RolePermissionService) {}

  @Post('bulk')
  async bulkCreate(@Body() bulkCreateDto: BulkCreateRolePermissionsDto) {
    return await this.rolePermissionService.bulkCreate(bulkCreateDto);
  }

  @Get()
  async findAll(@Query() getAllRolePermissionDto: GetAllRolePermissionDto) {
    return await this.rolePermissionService.findAll(getAllRolePermissionDto);
  }

  @Delete('bulk')
  async bulkDelete(
    @Body() bulkDeleteDto: BulkDeleteRolePermissionsDto,
    @Request() { user: { id: userId } }: { user: { id: string } },
  ) {
    return await this.rolePermissionService.bulkDelete(bulkDeleteDto, userId);
  }
}
