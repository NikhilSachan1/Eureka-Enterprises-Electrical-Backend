import { Module } from '@nestjs/common';
import { UserRoleService } from './user_role.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserRoleEntity } from './entities/user_role.entity';
import { UserRoleRepository } from './user_role.repository';

@Module({
  imports: [TypeOrmModule.forFeature([UserRoleEntity])],
  providers: [UserRoleService, UserRoleRepository],
  exports: [UserRoleService],
})
export class UserRoleModule {}
