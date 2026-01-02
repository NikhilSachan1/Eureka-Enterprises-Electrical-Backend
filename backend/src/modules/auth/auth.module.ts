import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/user.module';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { Environments } from 'env-configs';
import { SharedModule } from '../shared/shared.module';
import { EmailModule } from '../common/email/email.module';
import { UserRoleModule } from '../user-roles/user-role.module';
import { RolesGuard } from './guards/roles.guard';
import { RefreshTokenEntity } from './entities/refresh-token.entity';
import { RefreshTokenRepository } from './refresh-token.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([RefreshTokenEntity]),
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
  providers: [AuthService, RolesGuard, RefreshTokenRepository],
  controllers: [AuthController],
  exports: [AuthService, RolesGuard],
})
export class AuthModule {}
