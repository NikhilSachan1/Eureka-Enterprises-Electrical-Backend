import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './entities/user.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserRepository } from './user.repository';
import { SharedModule } from '../shared/shared.module';
import { RolesModule } from '../roles/role.module';
import { UserRoleModule } from '../user-roles/user-role.module';
import { ConfigurationsModule } from '../configurations/configuration.module';
import { ConfigSettingsModule } from '../config-settings/config-setting.module';
import { FilesModule } from '../common/file-upload/files.module';
import { UserDocumentModule } from '../user-documents/user-document.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    SharedModule,
    RolesModule,
    UserRoleModule,
    ConfigurationsModule,
    ConfigSettingsModule,
    FilesModule,
    UserDocumentModule,
  ],
  providers: [UserService, UserRepository],
  exports: [UserService],
  controllers: [UserController],
})
export class UsersModule {}
