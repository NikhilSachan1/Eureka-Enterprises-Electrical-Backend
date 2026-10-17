import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequiredPermission } from 'src/modules/auth/decorators/required-permission.decorator';
import { UserDelegationService } from './user-delegation.service';
import { ManagedUsersService } from './managed-users.service';
import {
  CreateDelegationDto,
  GetDelegationsDto,
  GetManagedUsersDto,
} from './dto/user-delegation.dto';
import { DelegatableModule } from './constants/user-delegation.constants';

@ApiTags('User Delegations')
@ApiBearerAuth('JWT-auth')
@Controller('user-delegations')
export class UserDelegationController {
  constructor(
    private readonly delegationService: UserDelegationService,
    private readonly managedUsers: ManagedUsersService,
  ) {}

  @Post()
  @RequiredPermission('user-delegation.manage')
  @ApiOperation({
    summary: 'Let one employee work on another’s entries for a module',
    description:
      'Widens whose rows the manager may add and see. It grants no new action: somebody who ' +
      'cannot approve an expense still cannot approve one for the people they manage. Two people ' +
      'may hold the same member for the same module. Only the office roles can grant this — a ' +
      'manager cannot add members to their own list.',
  })
  async create(@Body() dto: CreateDelegationDto, @Request() req: any) {
    return await this.delegationService.create(dto, req?.user?.id);
  }

  @Get()
  @RequiredPermission('user-delegation.view-list')
  @ApiOperation({
    summary: 'Who may work on whose entries',
    description:
      'Filter by module, manager or member. Withdrawn grants are included with `isActive: false` ' +
      'so past arrangements stay answerable; pass `activeOnly=true` for only those in force today.',
  })
  async findAll(@Query() query: GetDelegationsDto) {
    return await this.delegationService.findAll(query);
  }

  @Get('modules')
  @RequiredPermission('user-delegation.view-list')
  @ApiOperation({
    summary: 'The modules delegation actually governs',
    description:
      'A delegation row may name any module, but only these are read anywhere in the code. Use ' +
      'this for the dropdown rather than the full module config, which would offer options that ' +
      'do nothing.',
  })
  modules() {
    return this.delegationService.supportedModules();
  }

  @Get('managed-users')
  @ApiOperation({
    summary: 'The people I may file entries for',
    description:
      'For the employee filter on the expense and fuel screens. Always includes the caller, so ' +
      '"only mine" is one of the options. An office role gets everybody and `scope: all`. No ' +
      'permission beyond being logged in — it only ever describes the caller’s own reach.',
  })
  async getManagedUsers(@Query() query: GetManagedUsersDto, @Request() req: any) {
    return await this.managedUsers.listManagedUsers(
      req?.user?.id,
      req?.user?.activeRole ?? req?.user?.role,
      query.module as DelegatableModule,
    );
  }

  @Delete(':id')
  @RequiredPermission('user-delegation.manage')
  @ApiOperation({
    summary: 'Withdraw a delegation',
    description:
      'Ends it today rather than erasing it, so entries already filed under it stay explainable ' +
      'and "who was allowed to do this in August" remains answerable.',
  })
  async withdraw(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return await this.delegationService.withdraw(id, req?.user?.id);
  }
}
