import { Controller, Get, Query, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequiredPermission } from '../auth/decorators/required-permission.decorator';
import { DateTimeService } from 'src/utils/datetime';
import { LeaveAccrualService } from './leave-accrual.service';
import { GetLeaveLedgerDto, GetMyLeaveLedgerDto } from './dto/leave-ledger.dto';
import { IST_TIMEZONE, LEAVE_LEDGER_PERMISSIONS } from './constants/leave-ledger.constants';
import { LeaveLedgerRequest } from './types/leave-ledger.types';

@ApiTags('Leave Ledger')
@ApiBearerAuth('JWT-auth')
@Controller('leave-balances')
export class LeaveLedgerController {
  constructor(
    private readonly accrualService: LeaveAccrualService,
    private readonly dateTimeService: DateTimeService,
  ) {}

  @Get('ledger/me')
  @ApiOperation({ summary: 'My leave statement: every credit and debit with the balance after it' })
  getMyLedger(@Request() req: LeaveLedgerRequest, @Query() query: GetMyLeaveLedgerDto) {
    return this.view(req.user.id, query);
  }

  @Get('ledger')
  @RequiredPermission(LEAVE_LEDGER_PERMISSIONS.VIEW_ALL)
  @ApiOperation({ summary: "Any employee's leave statement" })
  getLedger(@Query() query: GetLeaveLedgerDto) {
    return this.view(query.userId, query);
  }

  private view(userId: string, query: GetMyLeaveLedgerDto) {
    const today = this.dateTimeService.getTodayString(IST_TIMEZONE);
    return this.accrualService.getLedgerView(
      userId,
      query.financialYear ?? this.accrualService.financialYearOfMonth(today.slice(0, 7)),
      today,
      { leaveCategory: query.leaveCategory, page: query.page, pageSize: query.pageSize },
    );
  }
}
