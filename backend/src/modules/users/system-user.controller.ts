import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequiredPermission } from 'src/modules/auth/decorators/required-permission.decorator';
import { UserFromRequest } from '../auth/auth.types';
import { CreateSystemUserDto, GetUsersDto, UpdateSystemUserDto } from './dto';
import { UserService } from './user.service';

const PROFILE_PICTURE_FIELD = [{ name: 'profilePicture', maxCount: 1 }];

const BASIC_DETAILS_SCHEMA = {
  firstName: { type: 'string', example: 'Mayank' },
  lastName: { type: 'string', example: 'Sharma' },
  email: { type: 'string', format: 'email', example: 'user@example.com' },
  contactNumber: { type: 'string', example: '+919876543210' },
  profilePicture: { type: 'string', format: 'binary' },
};

@ApiTags('System Users')
@ApiBearerAuth('JWT-auth')
@Controller('system-users')
export class SystemUserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @RequiredPermission('system-user.view')
  @ApiOperation({
    summary: 'List system users',
    description: 'Paginated, with search and filters.',
  })
  async findAll(@Query() query: GetUsersDto) {
    return await this.userService.findAllSystemUsers(query);
  }

  @Get(':id')
  @RequiredPermission('system-user.view')
  @ApiOperation({ summary: 'Get a system user' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.userService.getSystemUser(id);
  }

  @Post()
  @RequiredPermission('system-user.add')
  @ApiOperation({
    summary: 'Create a system user',
    description:
      'Creates a login-only user with basic details. No salary, leave balance, attendance or ' +
      'payroll. The password is auto-generated and sent by email.',
  })
  @UseInterceptors(FileFieldsInterceptor(PROFILE_PICTURE_FIELD))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        ...BASIC_DETAILS_SCHEMA,
        roles: {
          type: 'array',
          items: { type: 'string' },
          example: ['ADMIN'],
          description: 'One or more role names. EMPLOYEE and DRIVER are not allowed.',
        },
      },
      required: ['firstName', 'lastName', 'email', 'contactNumber', 'roles'],
    },
  })
  async create(
    @Body() dto: CreateSystemUserDto,
    @Request() { user }: { user: UserFromRequest },
    @UploadedFiles() files?: { profilePicture?: Express.Multer.File[] },
  ) {
    return await this.userService.createSystemUser(dto, files, user);
  }

  @Patch(':id')
  @RequiredPermission('system-user.edit')
  @ApiOperation({
    summary: 'Update a system user',
    description:
      'Set status to ARCHIVED to block login. Roles are changed through the user-roles API.',
  })
  @UseInterceptors(FileFieldsInterceptor(PROFILE_PICTURE_FIELD))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        ...BASIC_DETAILS_SCHEMA,
        status: { type: 'string', enum: ['ACTIVE', 'ARCHIVED'] },
      },
    },
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSystemUserDto,
    @Request() { user }: { user: UserFromRequest },
    @UploadedFiles() files?: { profilePicture?: Express.Multer.File[] },
  ) {
    return await this.userService.updateSystemUser(id, dto, files, user);
  }

  @Delete(':id')
  @RequiredPermission('system-user.delete')
  @ApiOperation({
    summary: 'Delete a system user',
    description: 'Soft delete. The user must be archived first, same as employees.',
  })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() { user }: { user: UserFromRequest },
  ) {
    return await this.userService.deleteSystemUser(id, user);
  }
}
