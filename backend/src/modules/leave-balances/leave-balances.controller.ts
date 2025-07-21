import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';
import { LeaveBalancesService } from './leave-balances.service';
import { GetAllLeaveBalanceDto } from './dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { LeaveBalanceUserInterceptor } from './interceptors/leave-balance-user.interceptor';

@ApiTags('Leave Balances')
@ApiBearerAuth('JWT-auth')
@Controller('leave-balances')
export class LeaveBalancesController {
  constructor(private readonly leaveBalancesService: LeaveBalancesService) {}
  @Get()
  @UseInterceptors(LeaveBalanceUserInterceptor)
  getAllLeaveBalances(@Query() filter: GetAllLeaveBalanceDto) {
    return this.leaveBalancesService.getAllLeaveBalances(filter as any);
  }
}
