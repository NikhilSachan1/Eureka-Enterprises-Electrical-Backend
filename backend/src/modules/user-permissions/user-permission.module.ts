import { Module } from '@nestjs/common';
import { UserPermissionController } from './user-permission.controller';
import { UserPermissionService } from './user-permission.service';
import { UserPermissionRepository } from './user-permission.repository';
import { UserPermissionEntity } from './entities/user-permission.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { PermissionsModule } from '../permissions/permission.module';
import { RolesModule } from '../roles/role.module';
import { UtilityService } from 'src/utils/utility/utility.service';
import { UsersModule } from '../users/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserPermissionEntity]),
    SharedModule,
    PermissionsModule,
    RolesModule,
    UsersModule,
  ],
  controllers: [UserPermissionController],
  providers: [UserPermissionService, UserPermissionRepository, UtilityService],
  exports: [UserPermissionService],
})
export class UserPermissionsModule {}
