import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { RolePermissionService } from './role-permission.service';
import { CreateRolePermissionDto, BulkCreateRolePermissionsDto } from './dto/role-permission.dto';

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
}
