import { Controller, Get, Query, Request } from '@nestjs/common';
import { LeaveBalancesService } from './leave-balances.service';
import { GetAllLeaveBalanceDto, GetLeaveBalanceDto } from './dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Leave Balances')
@ApiBearerAuth('JWT-auth')
@Controller('leave-balances')
export class LeaveBalancesController {
  constructor(private readonly leaveBalancesService: LeaveBalancesService) {}
  @Get()
  getAllLeaveBalances(@Query() filter: GetAllLeaveBalanceDto) {
    return this.leaveBalancesService.getAllLeaveBalances(filter as any);
  }

  @Get('user/:userId')
  findOne(
    @Request() { user: { id: userId } }: { user: { id: string } },
    @Query() getLeaveBalanceDto: GetLeaveBalanceDto,
  ) {
    return this.leaveBalancesService.findOne({
      ...getLeaveBalanceDto,
      userId,
    } as any);
  }
}
