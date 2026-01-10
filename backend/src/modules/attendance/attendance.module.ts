import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceEntity } from './entities/attendance.entity';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { AttendanceRepository } from './attendance.repository';
import { ConfigurationsModule } from '../configurations/configuration.module';
import { SharedModule } from '../shared/shared.module';
import { EmailModule } from '../common/email/email.module';
import { UsersModule } from '../users/user.module';
import { SalaryStructureModule } from '../salary-structures/salary-structure.module';
import { ExpenseTrackerModule } from '../expense-tracker/expense-tracker.module';
import { LeaveApplicationsModule } from '../leave-applications/leave-applications.module';
import { LeaveBalancesModule } from '../leave-balances/leave-balances.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AttendanceEntity]),
    ConfigurationsModule,
    SharedModule,
    EmailModule,
    UsersModule,
    forwardRef(() => SalaryStructureModule),
    forwardRef(() => ExpenseTrackerModule),
    forwardRef(() => LeaveApplicationsModule),
    forwardRef(() => LeaveBalancesModule),
  ],
  providers: [AttendanceService, AttendanceRepository],
  exports: [AttendanceService],
  controllers: [AttendanceController],
})
export class AttendanceModule {}
