import { Controller, Post, Get, Body, Query, Param, Patch, Request, Delete } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PermissionService } from './permission.service';
import {
  CreatePermissionDto,
  DeletePermissionDto,
  UpdatePermissionDto,
  GetPermissionDto,
} from './dto';

@ApiTags('Permissions')
@ApiBearerAuth('JWT-auth')
@Controller('permissions')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new permission',
    description:
      'Creates a new permission in the system with the provided permission details. The creator is automatically tracked.',
  })
  async create(
    @Request() { user: { id: userId } }: { user: { id: string } },
    @Body() createPermissionDto: CreatePermissionDto,
  ) {
    return await this.permissionService.create({
      ...createPermissionDto,
      createdBy: userId,
    });
  }

  @Get()
  @ApiOperation({
    summary: 'Get all permissions',
    description:
      'Retrieves a list of all available permissions in the system with optional filtering by module and search by label.',
  })
  async findAll(@Query() query: GetPermissionDto) {
    return await this.permissionService.findAll(query);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a permission',
    description:
      'Updates an existing permission by its ID with the provided permission details. The updater is automatically tracked.',
  })
  async update(
    @Request() { user: { id: userId } }: { user: { id: string } },
    @Param('id') id: string,
    @Body() updatePermissionDto: UpdatePermissionDto,
  ) {
    return await this.permissionService.update(
      { id },
      { ...updatePermissionDto, updatedBy: userId },
    );
  }

  @Delete('bulk')
  @ApiOperation({
    summary: 'Delete multiple permissions',
    description:
      'Deletes multiple permissions from the system based on the provided permission IDs. The deleter is automatically tracked.',
  })
  async delete(
    @Request() { user: { id: userId } }: { user: { id: string } },
    @Body() deletePermissionDto: DeletePermissionDto,
  ) {
    return await this.permissionService.deleteBulk(deletePermissionDto, userId);
  }
}
