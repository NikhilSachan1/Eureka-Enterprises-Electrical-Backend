import { Body, Controller, Delete, Get, Param, Patch, Query, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserService } from './user.service';
import { GetUsersDto, UpdateUserDto } from './dto';

@ApiTags('User')
@ApiBearerAuth('JWT-auth')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  async findAll(@Query() query: GetUsersDto) {
    return await this.userService.findAll(query);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Request() { user: { id: updatedBy } }: any,
    @Body() updatedUser: UpdateUserDto,
  ) {
    return await this.userService.update({ id }, { updatedBy, ...updatedUser });
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Request() { user: { id: deletedBy } }: any) {
    return await this.userService.delete(id, deletedBy);
  }
}
