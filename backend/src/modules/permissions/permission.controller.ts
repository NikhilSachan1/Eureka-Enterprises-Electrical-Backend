import { Controller, Post, Get, Body, Query, Param, Patch, Request, Delete } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PermissionService } from './permission.service';
import { CreatePermissionDto, DeletePermissionDto, UpdatePermissionDto } from './dto';
import { PermissionEntity } from './entities/permission.entity';
import { FindManyOptions } from 'typeorm';

@ApiTags('Permissions')
@ApiBearerAuth('JWT-auth')
@Controller('permissions')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Post()
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
  async findAll(@Query() query: FindManyOptions<PermissionEntity>) {
    return await this.permissionService.findAll(query);
  }

  @Patch(':id')
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
  async delete(
    @Request() { user: { id: userId } }: { user: { id: string } },
    @Body() deletePermissionDto: DeletePermissionDto,
  ) {
    return await this.permissionService.deleteBulk(deletePermissionDto, userId);
  }
}
