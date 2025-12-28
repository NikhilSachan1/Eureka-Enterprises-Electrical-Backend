import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { join } from 'path';
import { EmailService } from './email.service';
import { Environments } from '../../../../env-configs';

@Module({
  imports: [
    MailerModule.forRoot({
      transport: {
        host: Environments.EMAIL_HOST,
        port: Environments.EMAIL_PORT,
        auth: {
          user: Environments.EMAIL_FROM,
          pass: Environments.EMAIL_FROM,
        },
      },
      defaults: {
        from: Environments.EMAIL_FROM,
      },
      template: {
        dir: join(__dirname, 'templates'),
        adapter: new HandlebarsAdapter(),
        options: {
          strict: true,
        },
      },
    }),
  ],
  providers: [EmailService],
  exports: [EmailService],
})
export class MailModule {}
