import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserDocumentEntity } from './entities/user-document.entity';
import { UserDocumentRepository } from './user-document.repository';
import { UserDocumentService } from './user-document.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserDocumentEntity])],
  providers: [UserDocumentRepository, UserDocumentService],
  exports: [UserDocumentService],
})
export class UserDocumentModule {}
