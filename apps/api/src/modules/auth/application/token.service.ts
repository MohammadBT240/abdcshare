import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EntityManager } from '@mikro-orm/postgresql';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { PartnerDesignation, RoleName } from '@abdcshare/shared';
import { UserEntity } from '../../users/infrastructure/persistence/user.entity';
import { RefreshTokenEntity } from '../infrastructure/persistence/refresh-token.entity';

export interface TokenSubject {
  id: string;
  email: string;
  role: RoleName;
  partnerDesignation?: PartnerDesignation | null;
  clientId?: string | null;
  mustChangePassword: boolean;
}
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly em: EntityManager,
  ) {}

  private hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private signAccess(subject: TokenSubject): Promise<string> {
    return this.jwt.signAsync(
      {
        sub: subject.id,
        email: subject.email,
        role: subject.role,
        partnerDesignation: subject.partnerDesignation ?? null,
        clientId: subject.clientId ?? null,
        mustChangePassword: subject.mustChangePassword,
      },
      {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<number>('JWT_ACCESS_TTL', 900),
      },
    );
  }

  /** Issue a fresh access + refresh pair, starting a new rotation family. */
  async issuePair(subject: TokenSubject): Promise<TokenPair> {
    return this.issueWithFamily(subject, randomUUID());
  }

  private async issueWithFamily(subject: TokenSubject, familyId: string): Promise<TokenPair> {
    const raw = randomBytes(32).toString('hex');
    const ttl = this.config.get<number>('JWT_REFRESH_TTL', 1209600);
    const row = this.em.create(RefreshTokenEntity, {
      user: this.em.getReference(UserEntity, subject.id),
      tokenHash: this.hash(raw),
      familyId,
      expiresAt: new Date(Date.now() + ttl * 1000),
    });
    await this.em.persistAndFlush(row);
    return { accessToken: await this.signAccess(subject), refreshToken: raw };
  }

  /** Rotate a refresh token; detect reuse (revoked token replayed → revoke the whole family). */
  async rotate(rawRefresh: string): Promise<TokenPair> {
    const row = await this.em.findOne(RefreshTokenEntity, { tokenHash: this.hash(rawRefresh) }, { populate: ['user', 'user.role'] });
    if (!row) throw new UnauthorizedException('Invalid refresh token');

    if (row.revokedAt) {
      // Reuse of an already-rotated token → compromise; revoke the family.
      await this.em.nativeUpdate(RefreshTokenEntity, { familyId: row.familyId, revokedAt: null }, { revokedAt: new Date() });
      throw new UnauthorizedException('Refresh token reuse detected');
    }
    if (row.expiresAt.getTime() < Date.now()) throw new UnauthorizedException('Refresh token expired');

    row.revokedAt = new Date();
    await this.em.flush();

    const user = row.user;
    return this.issueWithFamily(
      {
        id: user.id,
        email: user.email,
        role: user.role.roleName,
        partnerDesignation: user.partnerDesignation ?? null,
        clientId: user.client?.id ?? null,
        mustChangePassword: user.mustChangePassword,
      },
      row.familyId,
    );
  }

  /** Revoke a single presented refresh token (logout). */
  async revoke(rawRefresh: string): Promise<void> {
    await this.em.nativeUpdate(RefreshTokenEntity, { tokenHash: this.hash(rawRefresh) }, { revokedAt: new Date() });
  }

  /** Revoke every active refresh token for a user (e.g. after password change). */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.em.nativeUpdate(RefreshTokenEntity, { user: userId, revokedAt: null }, { revokedAt: new Date() });
  }
}
