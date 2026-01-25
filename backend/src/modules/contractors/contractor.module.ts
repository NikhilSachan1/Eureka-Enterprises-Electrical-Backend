import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractorController } from './contractor.controller';
import { ContractorService } from './contractor.service';
import { ContractorRepository } from './contractor.repository';
import { ContractorEntity } from './entities/contractor.entity';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [TypeOrmModule.forFeature([ContractorEntity]), SharedModule],
  controllers: [ContractorController],
  providers: [ContractorService, ContractorRepository],
  exports: [ContractorService, ContractorRepository],
})
export class ContractorModule {}
