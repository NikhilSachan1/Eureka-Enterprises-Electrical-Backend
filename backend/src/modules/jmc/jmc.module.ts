import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JmcController } from './jmc.controller';
import { JmcService } from './jmc.service';
import { JmcRepository } from './jmc.repository';
import { JmcEntity } from './entities/jmc.entity';

@Module({
  imports: [TypeOrmModule.forFeature([JmcEntity])],
  controllers: [JmcController],
  providers: [JmcService, JmcRepository],
  exports: [JmcService, JmcRepository],
})
export class JmcModule {}
