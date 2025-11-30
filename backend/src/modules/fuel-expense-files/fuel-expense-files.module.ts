import { Module } from '@nestjs/common';
import { FuelExpenseFilesService } from './fuel-expense-files.service';
import { FuelExpenseFilesRepository } from './fuel-expense-files.repository';
import { FuelExpenseFilesEntity } from './entities/fuel-expense-files.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

/**
 * Fuel Expense Files Module
 * Handles file attachments for fuel expense records
 */
@Module({
  imports: [TypeOrmModule.forFeature([FuelExpenseFilesEntity])],
  providers: [FuelExpenseFilesService, FuelExpenseFilesRepository],
  exports: [FuelExpenseFilesService],
})
export class FuelExpenseFilesModule {}
