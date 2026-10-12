import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PetroCardWalletService } from './petro-card-wallet.service';
import { PetroCardWalletController } from './petro-card-wallet.controller';
import { PetroCardWalletRepository } from './petro-card-wallet.repository';
import { PetroCardWalletRechargeEntity } from './entities/petro-card-wallet-recharge.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PetroCardWalletRechargeEntity])],
  controllers: [PetroCardWalletController],
  providers: [PetroCardWalletService, PetroCardWalletRepository],
  // The fuel module imports this to refuse an entry the wallet cannot cover.
  exports: [PetroCardWalletService],
})
export class PetroCardWalletModule {}
