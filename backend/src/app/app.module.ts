import { UsersModule } from 'src/modules/users/user.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import { Module, Scope } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HttpErrorFilter } from 'src/utils/custom-error-filter/error.filter';
import { RequestInterceptor } from 'src/utils/middleware/request.interceptor';
import { ResponseInterceptor } from 'src/utils/middleware/response.interceptor';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { AppConfigModule } from 'src/utils/config/config.module';
import { CustomLoggerModule } from 'src/utils/custom-logger/custom-logger.module';
import { SharedModule } from 'src/modules/shared/shared.module';
import { FilesModule } from 'src/modules/common/file-upload/files.module';
import { RolesModule } from 'src/modules/roles/role.module';
import { ConfigurationsModule } from 'src/modules/configurations/configuration.module';
import { ConfigSettingsModule } from 'src/modules/config-settings/config-setting.module';
import { PermissionsModule } from 'src/modules/permissions/permission.module';
import { RolePermissionsModule } from 'src/modules/role-permissions/role-permission.module';
import { UserPermissionsModule } from 'src/modules/user-permissions/user-permission.module';
import { AttendanceModule } from 'src/modules/attendance/attendance.module';
import { SchedulerModule } from 'src/modules/scheduler/scheduler.module';
import { LeaveBalancesModule } from 'src/modules/leave-balances/leave-balances.module';
import { LeaveApplicationsModule } from 'src/modules/leave-applications/leave-applications.module';
import { ExpenseTrackerModule } from 'src/modules/expense-tracker/expense-tracker.module';
import { CardsModule } from 'src/modules/cards/cards.module';
import { VehicleMastersModule } from 'src/modules/vehicle-masters/vehicle-masters.module';
import { VehicleEventsModule } from 'src/modules/vehicle-events/vehicle-events.module';
import { VehicleVersionsModule } from 'src/modules/vehicle-versions/vehicle-versions.module';
import { VehicleFilesModule } from 'src/modules/vehicle-files/vehicle-files.module';
import { AssetMastersModule } from 'src/modules/asset-masters/asset-masters.module';
import { AssetEventsModule } from 'src/modules/asset-events/asset-events.module';
import { AssetVersionsModule } from 'src/modules/asset-versions/asset-versions.module';
import { AssetFilesModule } from 'src/modules/asset-files/asset-files.module';
import { FuelExpenseModule } from 'src/modules/fuel-expense/fuel-expense.module';
import { AnnouncementsModule } from 'src/modules/announcements/announcement.module';
import { VehicleServicesModule } from 'src/modules/vehicle-services/vehicle-services.module';
import { VehicleServiceFilesModule } from 'src/modules/vehicle-service-files/vehicle-service-files.module';
import { SalaryStructureModule } from 'src/modules/salary-structures/salary-structure.module';
import { BonusModule } from 'src/modules/bonuses/bonus.module';
import { PayrollModule } from 'src/modules/payroll/payroll.module';
import { DateTimeModule } from 'src/utils/datetime';
import { TimezoneInterceptor } from 'src/utils/middleware/timezone.interceptor';
import { CronLogModule } from 'src/modules/cron-logs/cron-log.module';
import { AuditLogModule } from 'src/modules/audit-logs/audit-log.module';
import { RequestAuditInterceptor } from 'src/modules/audit-logs/interceptors/request-audit.interceptor';

@Module({
  imports: [
    UsersModule,
    AuthModule,
    AppConfigModule,
    CustomLoggerModule,
    SharedModule,
    FilesModule,
    RolesModule,
    ConfigurationsModule,
    ConfigSettingsModule,
    PermissionsModule,
    RolePermissionsModule,
    UserPermissionsModule,
    AttendanceModule,
    LeaveApplicationsModule,
    LeaveBalancesModule,
    ExpenseTrackerModule,
    CardsModule,
    VehicleMastersModule,
    VehicleVersionsModule,
    VehicleEventsModule,
    VehicleFilesModule,
    AssetMastersModule,
    AssetVersionsModule,
    AssetEventsModule,
    AssetFilesModule,
    FuelExpenseModule,
    AnnouncementsModule,
    VehicleServicesModule,
    VehicleServiceFilesModule,
    SalaryStructureModule,
    BonusModule,
    PayrollModule,
    ScheduleModule.forRoot(),
    SchedulerModule,
    DateTimeModule,
    CronLogModule,
    AuditLogModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      scope: Scope.REQUEST,
      useClass: RequestInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TimezoneInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestAuditInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: HttpErrorFilter,
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    Reflector,
  ],
})
export class AppModule {
  // constructor() {
  //   this.runMigrations();
  // }
  // configure(consumer: MiddlewareConsumer) {
  //   consumer.apply(LoggerMiddleware).forRoutes('*');
  // }
  // async runMigrations() {
  //   const options = ConfigService.getOrmConfig('migration_connection', true);
  //   const connection = new DataSource(options);
  //   await connection.initialize();
  //   try {
  //     await connection.runMigrations();
  //   } catch (error) {
  //     Logger.log(JSON.stringify(error));
  //   } finally {
  //     await connection.destroy();
  //   }
  // }
}
