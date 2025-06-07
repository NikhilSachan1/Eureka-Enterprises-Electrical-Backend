import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserPermissionService } from './user-permission.service';
import { CreateUserPermissionDto } from './dto/user-permission.dto';

@ApiTags('User Permissions')
@ApiBearerAuth('JWT-auth')
@Controller('user-permissions')
export class UserPermissionController {
  constructor(private readonly userPermissionService: UserPermissionService) {}

  @Post()
  async create(@Body() createUserPermissionDto: CreateUserPermissionDto) {
    return await this.userPermissionService.create(createUserPermissionDto);
  }

  @Get('user/:userId')
  async getUserPermissions(@Param('userId') userId: string) {
    return await this.userPermissionService.getUserPermissions(userId);
  }
}
