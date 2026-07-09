import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyBankAccountEntity } from './entities/company-bank-account.entity';
import { CompanyBankAccountRepository } from './company-bank-account.repository';
import { CompanyBankAccountService } from './company-bank-account.service';
import { CompanyBankAccountController } from './company-bank-account.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CompanyBankAccountEntity])],
  controllers: [CompanyBankAccountController],
  providers: [CompanyBankAccountRepository, CompanyBankAccountService],
  exports: [CompanyBankAccountService],
})
export class CompanyBankAccountModule {}
