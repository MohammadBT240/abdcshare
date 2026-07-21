import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { UserEntity } from '../users/infrastructure/persistence/user.entity';
import { RefreshTokenEntity } from './infrastructure/persistence/refresh-token.entity';
import { TokenService } from './application/token.service';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

// JwtService comes from the global JwtModule registered in AppModule.
@Module({
  imports: [MikroOrmModule.forFeature([UserEntity, RefreshTokenEntity])],
  controllers: [AuthController],
  providers: [AuthService, TokenService],
  exports: [TokenService],
})
export class AuthModule {}
