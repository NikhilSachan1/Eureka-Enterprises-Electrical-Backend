import { Module } from '@nestjs/common';
import * as providers from './index';

@Module({
  providers: Object.values(providers),
  exports: Object.values(providers),
})
export class CustomLoggerModule {}
