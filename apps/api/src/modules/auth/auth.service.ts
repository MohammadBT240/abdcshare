import { Injectable, UnauthorizedException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import bcrypt from 'bcryptjs';
import { UserEntity } from '../users/infrastructure/persistence/user.entity';
import { TokenService } from './application/token.service';
import type { LoginDto } from './presentation/dto/login.dto';
import type { ChangePasswordDto } from './presentation/dto/change-password.dto';
import type { AuthTokensDto, AuthUserDto } from './presentation/dto/auth-response.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly em: EntityManager,
    private readonly tokens: TokenService,
  ) {}

  private toAuthUser(user: UserEntity): AuthUserDto {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role.roleName,
      mustChangePassword: user.mustChangePassword,
    };
  }

  async login(dto: LoginDto): Promise<AuthTokensDto> {
    const user = await this.em.findOne(UserEntity, { email: dto.email.toLowerCase() }, { populate: ['role'] });
    if (!user || !user.isActive || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const pair = await this.tokens.issuePair({
      id: user.id,
      email: user.email,
      role: user.role.roleName,
      partnerDesignation: user.partnerDesignation ?? null,
      clientId: user.client?.id ?? null,
      mustChangePassword: user.mustChangePassword,
    });
    return { ...pair, user: this.toAuthUser(user) };
  }

  async refresh(refreshToken: string): Promise<Pick<AuthTokensDto, 'accessToken' | 'refreshToken'>> {
    return this.tokens.rotate(refreshToken);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revoke(refreshToken);
  }

  async me(userId: string): Promise<AuthUserDto> {
    const user = await this.em.findOneOrFail(UserEntity, { id: userId }, { populate: ['role'] });
    return this.toAuthUser(user);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.em.findOneOrFail(UserEntity, { id: userId });
    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    user.passwordHash = await bcrypt.hash(dto.newPassword, 12);
    user.mustChangePassword = false;
    await this.em.flush();
    await this.tokens.revokeAllForUser(userId); // force re-login everywhere
  }
}
