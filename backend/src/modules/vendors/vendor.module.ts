import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VendorController } from './vendor.controller';
import { VendorService } from './vendor.service';
import { VendorRepository } from './vendor.repository';
import { VendorEntity } from './entities/vendor.entity';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [TypeOrmModule.forFeature([VendorEntity]), SharedModule],
  controllers: [VendorController],
  providers: [VendorService, VendorRepository],
  exports: [VendorService, VendorRepository],
})
export class VendorModule {}
