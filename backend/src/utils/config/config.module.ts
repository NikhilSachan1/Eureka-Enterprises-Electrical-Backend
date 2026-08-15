import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from './config.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.env'],
      isGlobal: true,
    }),
    // forRootAsync (not forRoot) so the SSH tunnel is established during app
    // initialisation — a sync forRoot would build the config at import time,
    // before there is any chance to open the tunnel.
    TypeOrmModule.forRootAsync({
      useFactory: () => ConfigService.resolveOrmConfig('default', false),
    }),
  ],
  providers: [ConfigService],
})
export class AppConfigModule {}
