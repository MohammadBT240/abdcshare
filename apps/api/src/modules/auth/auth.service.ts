import { Injectable, UnauthorizedException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { EVENT } from '@abdcshare/shared';
import { UserEntity } from '../users/infrastructure/persistence/user.entity';
import { OutboxService } from '../outbox/outbox.service';
import { TokenService } from './application/token.service';
import { PasswordResetTokenEntity } from './infrastructure/persistence/password-reset-token.entity';
import type { LoginDto } from './presentation/dto/login.dto';
import type { ChangePasswordDto } from './presentation/dto/change-password.dto';
import type {
  ForgotPasswordDto,
  ResetPasswordDto,
} from './presentation/dto/password-reset.dto';
import type { AuthTokensDto, AuthUserDto } from './presentation/dto/auth-response.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly em: EntityManager,
    private readonly tokens: TokenService,
    private readonly outbox: OutboxService,
    private readonly config: ConfigService,
  ) {}

  private sha256(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Start a reset: if the email maps to an active user, mint a single-use token
   * and emit an outbox event for the worker to email the link. **Neutral response**
   * either way — no account enumeration.
   */
  async requestPasswordReset(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.em.findOne(UserEntity, { email: dto.email.toLowerCase() });
    if (!user || !user.isActive) return;
    const raw = randomBytes(32).toString('hex');
    const ttl = this.config.get<number>('PASSWORD_RESET_TTL', 3600);
    this.em.create(PasswordResetTokenEntity, {
      user,
      tokenHash: this.sha256(raw),
      expiresAt: new Date(Date.now() + ttl * 1000),
    });
    this.outbox.enqueue(EVENT.PasswordResetRequested, { email: user.email, token: raw, userId: user.id });
    await this.em.flush();
  }

  /** Complete a reset: verify the token, set the new password, revoke all sessions. */
  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const row = await this.em.findOne(
      PasswordResetTokenEntity,
      { tokenHash: this.sha256(dto.token) },
      { populate: ['user'] },
    );
    if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }
    row.user.passwordHash = await bcrypt.hash(dto.newPassword, 12);
    row.user.mustChangePassword = false;
    row.usedAt = new Date();
    await this.em.flush();
    await this.tokens.revokeAllForUser(row.user.id);
    this.outbox.enqueue(EVENT.PasswordChanged, { email: row.user.email, userId: row.user.id });
    await this.em.flush();
  }

  private toAuthUser(user: UserEntity): AuthUserDto {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role.roleName,
      mustChangePassword: user.mustChangePassword,
      partnerDesignation: user.partnerDesignation ?? null,
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
