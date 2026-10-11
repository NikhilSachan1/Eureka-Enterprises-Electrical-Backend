import { Controller, Get, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MyDashboardService } from './my-dashboard.service';

/**
 * The web dashboard an employee or driver sees — the admin one, from one desk.
 *
 * Section-wise like the admin dashboard, so each card loads and refreshes on its own.
 *
 * No role guard and no permission on any of these. Every endpoint answers only about
 * `req.user.id`, and none of them takes a user id, so there is nothing to tamper with: a driver
 * cannot ask for another driver's fuel because there is no way to express the question. The
 * company-wide endpoints next door keep their admin guard.
 */
@ApiTags('Dashboard (Mine)')
@ApiBearerAuth('JWT-auth')
@Controller('dashboard/me')
export class MyDashboardController {
  constructor(private readonly myDashboard: MyDashboardService) {}

  private userId(req: any): string {
    return req?.user?.id;
  }

  @Get('attendance')
  @ApiOperation({
    summary: 'My attendance — today, this month, last month',
    description:
      "Today's status, check-in/out and the project resolved from my allocation, plus counts by " +
      'status for this month and last. `daysRecorded` is how many days actually have a record — ' +
      'there is no working-day figure, because nothing computes one yet.',
  })
  async attendance(@Request() req: any) {
    return await this.myDashboard.getAttendance(this.userId(req));
  }

  @Get('leave')
  @ApiOperation({
    summary: 'My leave — balance per category, pending requests, what is coming',
    description:
      'Balances are for the current financial year and use the same arithmetic as the mobile ' +
      'dashboard, so the two agree.',
  })
  async leave(@Request() req: any) {
    return await this.myDashboard.getLeave(this.userId(req));
  }

  @Get('expense')
  @ApiOperation({
    summary: 'My money — what is owed to me, this month’s claims, and category totals',
    description:
      '`settlement.pending` is the same figure as the pending-settlement screen: approved debits ' +
      'minus every credit. It can be negative when an advance has been paid. Drivers also get ' +
      '`foodAllowance`, showing the days the attendance allowance stayed with them and the days ' +
      'it went to an engineer; it is null for everyone else.',
  })
  async expense(@Request() req: any) {
    return await this.myDashboard.getExpense(this.userId(req));
  }

  @Get('project')
  @ApiOperation({
    summary: 'My project — where I am today, and where I have been',
    description:
      'Resolved from the allocation, so a correction made in the office shows here immediately. ' +
      'Null is the normal answer for anyone not currently allocated.',
  })
  async project(@Request() req: any) {
    return await this.myDashboard.getProject(this.userId(req));
  }

  @Get('assets')
  @ApiOperation({
    summary: 'My assets, and handovers waiting on me',
    description:
      'Calibration and warranty are returned with the days left on them, negative once passed. ' +
      'A pending handover carries the hours left before the auto-penalty accepts it on my behalf, ' +
      'read from the same config the penalty cron reads.',
  })
  async assets(@Request() req: any) {
    return await this.myDashboard.getAssets(this.userId(req));
  }

  @Get('vehicle')
  @ApiOperation({
    summary: 'My vehicle — drivers only',
    description:
      'The vehicle I hold, with insurance, PUC and fitness expiry and the days left on each, plus ' +
      'any handover waiting on me. `isDriver: false` means the card should be hidden — a ' +
      'non-driver is answered rather than refused, so an empty result is never mistaken for an error.',
  })
  async vehicle(@Request() req: any) {
    return await this.myDashboard.getVehicle(this.userId(req));
  }

  @Get('fuel')
  @ApiOperation({
    summary: 'My fuel this month — drivers only, numbers only',
    description:
      'Entries, litres and amount for the current month, split by approval state. PetroCard spend ' +
      'is reported separately from what the driver paid himself: the first comes out of the ' +
      'company wallet, and adding the two together would misstate both.',
  })
  async fuel(@Request() req: any) {
    return await this.myDashboard.getFuel(this.userId(req));
  }

  @Get('alerts')
  @ApiOperation({
    summary: 'What I need to do',
    description:
      'Only things this person can act on: a handover waiting to be accepted (with its countdown), ' +
      'attendance awaiting approval, a leave balance running out, and documents or calibration ' +
      'expiring. Sorted most urgent first.',
  })
  async alerts(@Request() req: any) {
    return await this.myDashboard.getAlerts(this.userId(req));
  }
}
