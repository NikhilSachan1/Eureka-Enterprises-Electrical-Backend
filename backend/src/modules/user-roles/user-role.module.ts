import { Module } from '@nestjs/common';
import { UserRoleService } from './user-role.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserRoleEntity } from './entities/user-role.entity';
import { UserRoleRepository } from './user-role.repository';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [TypeOrmModule.forFeature([UserRoleEntity]), SharedModule],
  providers: [UserRoleService, UserRoleRepository],
  exports: [UserRoleService],
})
export class UserRoleModule {}
