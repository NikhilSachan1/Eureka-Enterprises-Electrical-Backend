import { Module, forwardRef } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/user.module';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { Environments } from 'env-configs';
import { SharedModule } from '../shared/shared.module';
import { MailModule } from '../common/email/email.module';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    JwtModule.register({
      global: true,
      secret: Environments.JWT_AUTH_SECRET_KEY,
      signOptions: { expiresIn: Environments.JWT_AUTH_TOKEN_EXPIRY },
    }),
    SharedModule,
    MailModule,
  ],
  providers: [AuthService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
