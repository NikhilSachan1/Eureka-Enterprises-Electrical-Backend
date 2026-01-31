import { Controller, Post, Delete, Body, Request, Query, Get } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
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
  @ApiOperation({
    summary: 'Bulk create role permissions',
    description:
      'Creates multiple role-permission associations in a single operation, linking roles with their corresponding permissions.',
  })
  async bulkCreate(@Body() bulkCreateDto: BulkCreateRolePermissionsDto) {
    return await this.rolePermissionService.bulkCreate(bulkCreateDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all role permissions',
    description:
      'Retrieves a list of all role-permission associations in the system with optional filtering and pagination.',
  })
  async findAll(@Query() getAllRolePermissionDto: GetAllRolePermissionDto) {
    return await this.rolePermissionService.findAll(getAllRolePermissionDto);
  }

  @Delete('bulk')
  @ApiOperation({
    summary: 'Bulk delete role permissions',
    description:
      'Deletes multiple role-permission associations from the system based on the provided role and permission IDs. The deleter is automatically tracked.',
  })
  async bulkDelete(
    @Body() bulkDeleteDto: BulkDeleteRolePermissionsDto,
    @Request() { user: { id: userId } }: { user: { id: string } },
  ) {
    return await this.rolePermissionService.bulkDelete(bulkDeleteDto, userId);
  }
}
