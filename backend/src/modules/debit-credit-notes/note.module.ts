import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DebitNoteEntity } from './entities/debit-note.entity';
import { CreditNoteEntity } from './entities/credit-note.entity';
import { NoteRepository } from './note.repository';
import { NoteService } from './note.service';
import { NoteController } from './note.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DebitNoteEntity, CreditNoteEntity])],
  controllers: [NoteController],
  providers: [NoteRepository, NoteService],
  exports: [NoteRepository, NoteService],
})
export class NoteModule {}
