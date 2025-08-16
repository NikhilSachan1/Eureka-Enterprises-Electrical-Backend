import { Module } from '@nestjs/common';
import { ExpenseFilesService } from './expense-files.service';
import { ExpenseFilesRepository } from './expense-files.repository';
import { ExpenseFilesEntity } from './entities/expense-files.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([ExpenseFilesEntity])],
  providers: [ExpenseFilesService, ExpenseFilesRepository],
  exports: [ExpenseFilesService],
})
export class ExpenseFilesModule {}
