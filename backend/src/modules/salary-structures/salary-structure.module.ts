import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalaryStructureEntity } from './entities/salary-structure.entity';
import { SalaryStructureController } from './salary-structure.controller';
import { SalaryStructureService } from './salary-structure.service';
import { SalaryStructureRepository } from './salary-structure.repository';
import { SalaryChangeLogEntity } from '../salary-change-logs/entities/salary-change-log.entity';
import { SalaryChangeLogRepository } from '../salary-change-logs/salary-change-log.repository';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SalaryStructureEntity, SalaryChangeLogEntity]),
    SharedModule,
  ],
  controllers: [SalaryStructureController],
  providers: [SalaryStructureService, SalaryStructureRepository, SalaryChangeLogRepository],
  exports: [SalaryStructureService, SalaryStructureRepository],
})
export class SalaryStructureModule {}
