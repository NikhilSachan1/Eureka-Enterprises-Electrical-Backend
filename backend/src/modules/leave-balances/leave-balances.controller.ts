import { Controller, Get, Query } from '@nestjs/common';
import { LeaveBalancesService } from './leave-balances.service';
import { GetAllLeaveBalanceDto, GetLeaveBalanceDto } from './dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Leave Balances')
@ApiBearerAuth('JWT-auth')
@Controller('leave-balances')
export class LeaveBalancesController {
  constructor(private readonly leaveBalancesService: LeaveBalancesService) {}
  @Get()
  findAll(@Query() filter: GetAllLeaveBalanceDto) {
    return this.leaveBalancesService.findAll(filter as any);
  }

  @Get('user/:userId')
  findOne(@Query() getLeaveBalanceDto: GetLeaveBalanceDto) {
    return this.leaveBalancesService.findOne(getLeaveBalanceDto as any);
  }
}
