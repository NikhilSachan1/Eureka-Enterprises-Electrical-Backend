import { Module } from '@nestjs/common';
import { RoleService } from './role.service';
import { RoleController } from './role.controller';
import { RoleRepository } from './role.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoleEntity } from './entities/role.entity';
import { PermissionEntity } from '../permissions/entities/permission.entity';
import { SharedModule } from '../shared/shared.module';
import { PermissionsModule } from '../permissions/permission.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RoleEntity, PermissionEntity]),
    SharedModule,
    PermissionsModule,
  ],
  providers: [RoleService, RoleRepository],
  exports: [RoleService],
  controllers: [RoleController],
})
export class RolesModule {}
