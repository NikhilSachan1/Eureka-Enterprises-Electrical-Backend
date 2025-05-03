import { UsersModule } from 'src/modules/users/user.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import { Module, Scope } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, Reflector } from '@nestjs/core';
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

@Module({
  imports: [
    UsersModule,
    AuthModule,
    AppConfigModule,
    CustomLoggerModule,
    SharedModule,
    FilesModule,
    RolesModule,
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
