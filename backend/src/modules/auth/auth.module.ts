import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/user.module';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { Environments } from 'env-configs';
import { SharedModule } from '../shared/shared.module';
import { EmailModule } from '../common/email/email.module';
import { UserRoleModule } from '../user-roles/user-role.module';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { RefreshTokenEntity } from './entities/refresh-token.entity';
import { RefreshTokenRepository } from './refresh-token.repository';
import { PermissionEntity } from '../permissions/entities/permission.entity';
import { RolePermissionEntity } from '../role-permissions/entities/role-permission.entity';
import { UserPermissionEntity } from '../user-permissions/entities/user-permission.entity';
import { RoleEntity } from '../roles/entities/role.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RefreshTokenEntity,
      PermissionEntity,
      RolePermissionEntity,
      UserPermissionEntity,
      RoleEntity,
    ]),
    forwardRef(() => UsersModule),
    JwtModule.register({
      global: true,
      secret: Environments.JWT_AUTH_SECRET_KEY,
      signOptions: { expiresIn: Environments.JWT_AUTH_TOKEN_EXPIRY },
    }),
    SharedModule,
    EmailModule,
    UserRoleModule,
  ],
  providers: [
    AuthService,
    RolesGuard,
    PermissionsGuard,
    RefreshTokenRepository,
    // Registered here (not in AppModule) so its repository deps —
    // PermissionEntity / RolePermissionEntity / UserPermissionEntity / RoleEntity —
    // resolve in AuthModule's DI scope where TypeOrmModule.forFeature has them.
    // APP_GUARD makes it apply globally regardless of where it's registered.
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
  controllers: [AuthController],
  exports: [AuthService, RolesGuard, PermissionsGuard],
})
export class AuthModule {}
