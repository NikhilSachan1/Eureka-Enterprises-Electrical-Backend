import { Controller, Post, Body, Get, Query, Patch, Param, Delete } from '@nestjs/common';
import { RoleService } from './role.service';
import { CreateRoleDto, GetAllRoleDto, UpdateRoleDto, DeleteRoleDto } from './dto';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Roles')
@ApiBearerAuth('JWT-auth')
@Controller('role')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Post()
  @ApiOperation({
    summary: 'Create role',
    description: 'Creates a new role with the specified name and permissions.',
  })
  async create(@Body() createRoleDto: CreateRoleDto) {
    return await this.roleService.create(createRoleDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all roles',
    description: 'Retrieves a list of all roles with optional filtering and pagination.',
  })
  async findAll(@Query() getAllRoleDto: GetAllRoleDto) {
    return await this.roleService.findAll(getAllRoleDto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update role',
    description: 'Updates an existing role with the provided data.',
  })
  async update(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return await this.roleService.update({ id }, updateRoleDto);
  }

  @Delete('bulk')
  @ApiOperation({
    summary: 'Bulk delete roles',
    description: 'Deletes multiple roles at once based on provided role IDs.',
  })
  async delete(@Body() deleteRoleDto: DeleteRoleDto) {
    return await this.roleService.deleteBulk(deleteRoleDto);
  }
}
