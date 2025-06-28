import { Controller, Post, Body, Get, Query, Patch, Param } from '@nestjs/common';
import { RoleService } from './role.service';
import { CreateRoleDto, GetAllRoleDto, UpdateRoleDto } from './dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Roles')
@ApiBearerAuth('JWT-auth')
@Controller('role')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Post()
  async create(@Body() createRoleDto: CreateRoleDto) {
    return await this.roleService.create(createRoleDto);
  }

  @Get()
  async findAll(@Query() getAllRoleDto: GetAllRoleDto) {
    return await this.roleService.findAll(getAllRoleDto);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return await this.roleService.update({ id }, updateRoleDto);
  }
}
