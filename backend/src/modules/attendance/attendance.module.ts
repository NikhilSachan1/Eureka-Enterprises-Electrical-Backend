import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceEntity } from './entities/attendance.entity';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { AttendanceRepository } from './attendance.repository';
import { ConfigurationsModule } from '../configurations/configuration.module';
import { SharedModule } from '../shared/shared.module';
import { EmailModule } from '../common/email/email.module';
import { UsersModule } from '../users/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AttendanceEntity]),
    ConfigurationsModule,
    SharedModule,
    EmailModule,
    UsersModule,
  ],
  providers: [AttendanceService, AttendanceRepository],
  exports: [AttendanceService],
  controllers: [AttendanceController],
})
export class AttendanceModule {}
