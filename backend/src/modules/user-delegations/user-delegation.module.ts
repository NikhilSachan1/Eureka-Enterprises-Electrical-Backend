import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModuleDelegationEntity } from './entities/user-module-delegation.entity';
import { UserDelegationController } from './user-delegation.controller';
import { UserDelegationService } from './user-delegation.service';
import { ManagedUsersService } from './managed-users.service';

/**
 * `ManagedUsersService` is exported because expense and fuel both have to ask it the same
 * question. Keeping one answer is the point — the rule it replaces existed as two copies of an
 * interceptor that could, and eventually would, drift apart.
 */
@Module({
  imports: [TypeOrmModule.forFeature([UserModuleDelegationEntity])],
  controllers: [UserDelegationController],
  providers: [UserDelegationService, ManagedUsersService],
  exports: [ManagedUsersService],
})
export class UserDelegationModule {}
