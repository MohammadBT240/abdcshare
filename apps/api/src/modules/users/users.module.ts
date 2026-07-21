import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { UserEntity } from './infrastructure/persistence/user.entity';
import { RoleEntity } from '../roles/infrastructure/persistence/role.entity';
import { BulkImportJobEntity } from './infrastructure/persistence/bulk-import-job.entity';
import { UsersService } from './users.service';
import { BulkUsersService } from './bulk-users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [MikroOrmModule.forFeature([UserEntity, RoleEntity, BulkImportJobEntity])],
  controllers: [UsersController],
  providers: [UsersService, BulkUsersService],
  exports: [UsersService],
})
export class UsersModule {}
