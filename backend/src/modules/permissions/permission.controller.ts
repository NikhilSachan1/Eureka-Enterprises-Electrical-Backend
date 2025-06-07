import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PermissionService } from './permission.service';
import { CreatePermissionDto } from './dto/permission.dto';
import { PermissionEntity } from './entities/permission.entity';
import { FindManyOptions } from 'typeorm';

@ApiTags('Permissions')
@ApiBearerAuth('JWT-auth')
@Controller('permissions')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Post()
  async create(@Body() createPermissionDto: CreatePermissionDto) {
    return await this.permissionService.create(createPermissionDto);
  }

  @Get()
  async findAll(@Query() query: FindManyOptions<PermissionEntity>) {
    return await this.permissionService.findAll(query);
  }
}
