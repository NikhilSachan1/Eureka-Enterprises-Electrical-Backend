import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PurchaseOrderController } from './purchase-order.controller';
import { PurchaseOrderService } from './purchase-order.service';
import { PurchaseOrderRepository } from './purchase-order.repository';
import { PurchaseOrderEntity } from './entities/purchase-order.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PurchaseOrderEntity])],
  controllers: [PurchaseOrderController],
  providers: [PurchaseOrderService, PurchaseOrderRepository],
  // Both are exported because SiteInvoiceService directly injects the
  // PurchaseOrderRepository to call findOneForUpdate / adjustRollups inside
  // its own approval/unlock transactions (where the EntityManager must be
  // shared across both repos). Restricting to Service-only would force a
  // cross-service indirection for every transaction-scoped lock, which adds
  // no encapsulation benefit at this layer.
  exports: [PurchaseOrderService, PurchaseOrderRepository],
})
export class PurchaseOrderModule {}
