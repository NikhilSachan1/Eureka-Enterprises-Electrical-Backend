import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SiteVendorEntity } from './entities/site-vendor.entity';
import { SiteVendorRepository } from './site-vendor.repository';
import { SiteVendorService } from './site-vendor.service';
import { SiteVendorController } from './site-vendor.controller';
import { VendorModule } from '../vendors/vendor.module';
import { SiteModule } from '../sites/site.module';

@Module({
  imports: [TypeOrmModule.forFeature([SiteVendorEntity]), VendorModule, SiteModule],
  controllers: [SiteVendorController],
  providers: [SiteVendorService, SiteVendorRepository],
  exports: [SiteVendorService, SiteVendorRepository],
})
export class SiteVendorModule {}
