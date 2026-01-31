import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';
import { LeaveBalancesService } from './leave-balances.service';
import { GetAllLeaveBalanceDto } from './dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { LeaveBalanceUserInterceptor } from './interceptors/leave-balance-user.interceptor';

@ApiTags('Leave Balances')
@ApiBearerAuth('JWT-auth')
@Controller('leave-balances')
export class LeaveBalancesController {
  constructor(private readonly leaveBalancesService: LeaveBalancesService) {}
  @Get()
  @UseInterceptors(LeaveBalanceUserInterceptor)
  @ApiOperation({
    summary: 'Get leave balances',
    description: 'Retrieves leave balance information for employees based on query filters.',
  })
  getAllLeaveBalances(@Query() filter: GetAllLeaveBalanceDto) {
    return this.leaveBalancesService.getAllLeaveBalances(filter as any);
  }
}
