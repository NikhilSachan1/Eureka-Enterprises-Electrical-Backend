import { Body, Controller, Get, Post, Query, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequiredPermission } from '../auth/decorators/required-permission.decorator';
import { DateTimeService } from 'src/utils/datetime';
import { LeaveAccrualService } from './leave-accrual.service';
import {
  ApplyLeaveRecalculationDto,
  GetLeaveLedgerDto,
  GetLeaveRecalculationDto,
  GetMyLeaveLedgerDto,
} from './dto/leave-ledger.dto';
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
  @ApiOperation({ summary: 'My leave ledger: every credit and debit, with month-wise earning' })
  getMyLedger(@Request() req: LeaveLedgerRequest, @Query() query: GetMyLeaveLedgerDto) {
    const today = this.today();
    return this.accrualService.getLedgerView(
      req.user.id,
      query.financialYear ?? this.accrualService.financialYearOfMonth(today.slice(0, 7)),
      today,
      query.leaveCategory,
    );
  }

  @Get('ledger')
  @RequiredPermission(LEAVE_LEDGER_PERMISSIONS.VIEW_ALL)
  @ApiOperation({ summary: "Any employee's leave ledger" })
  getLedger(@Query() query: GetLeaveLedgerDto) {
    const today = this.today();
    return this.accrualService.getLedgerView(
      query.userId,
      query.financialYear ?? this.accrualService.financialYearOfMonth(today.slice(0, 7)),
      today,
      query.leaveCategory,
    );
  }

  @Get('recalculation')
  @RequiredPermission(LEAVE_LEDGER_PERMISSIONS.RECALCULATE)
  @ApiOperation({
    summary: 'Old leave credit measured against attendance (review only, changes nothing)',
  })
  getRecalculation(@Query() query: GetLeaveRecalculationDto) {
    const today = this.today();
    return this.accrualService.getRecalculationReport(
      query.financialYear ?? this.accrualService.financialYearOfMonth(today.slice(0, 7)),
      today,
    );
  }

  @Post('recalculation/apply')
  @RequiredPermission(LEAVE_LEDGER_PERMISSIONS.RECALCULATE)
  @ApiOperation({ summary: 'Post the reviewed corrections to the ledger (once per employee)' })
  applyRecalculation(@Request() req: LeaveLedgerRequest, @Body() body: ApplyLeaveRecalculationDto) {
    return this.accrualService.applyRecalculation(
      body.financialYear,
      this.today(),
      req.user.id,
      body.userIds,
    );
  }

  private today(): string {
    return this.dateTimeService.getTodayString(IST_TIMEZONE);
  }
}
