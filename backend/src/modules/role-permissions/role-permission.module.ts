import { Module } from '@nestjs/common';
import { RolePermissionController } from './role-permission.controller';
import { RolePermissionService } from './role-permission.service';
import { RolePermissionRepository } from './role-permission.repository';
import { RolePermissionEntity } from './entities/role-permission.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UtilityService } from 'src/utils/utility/utility.service';
import { SharedModule } from '../shared/shared.module';
import { RolesModule } from '../roles/role.module';
import { PermissionsModule } from '../permissions/permission.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RolePermissionEntity]),
    SharedModule,
    RolesModule,
    PermissionsModule,
  ],
  controllers: [RolePermissionController],
  providers: [RolePermissionService, RolePermissionRepository, UtilityService],
  exports: [RolePermissionService],
})
export class RolePermissionsModule {}
