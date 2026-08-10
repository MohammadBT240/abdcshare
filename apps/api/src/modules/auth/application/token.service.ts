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

/** Concurrent / slightly-late rotates of the same token return the same pair. */
const ROTATION_GRACE_MS = 30_000;

@Injectable()
export class TokenService {
  /** In-flight rotates keyed by refresh-token hash (same process). */
  private readonly inflight = new Map<string, Promise<TokenPair>>();
  /** Recently issued pairs for a just-rotated (old) hash — grace for races. */
  private readonly recentByOldHash = new Map<string, { pair: TokenPair; until: number }>();

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

  private subjectFromUser(user: UserEntity): TokenSubject {
    return {
      id: user.id,
      email: user.email,
      role: user.role.roleName,
      partnerDesignation: user.partnerDesignation ?? null,
      clientId: user.client?.id ?? null,
      mustChangePassword: user.mustChangePassword,
    };
  }

  private rememberGrace(oldHash: string, pair: TokenPair): void {
    const until = Date.now() + ROTATION_GRACE_MS;
    this.recentByOldHash.set(oldHash, { pair, until });
    // Opportunistic cleanup of expired grace entries.
    for (const [key, entry] of this.recentByOldHash) {
      if (entry.until <= Date.now()) this.recentByOldHash.delete(key);
    }
  }

  private gracePair(oldHash: string): TokenPair | null {
    const entry = this.recentByOldHash.get(oldHash);
    if (!entry) return null;
    if (entry.until <= Date.now()) {
      this.recentByOldHash.delete(oldHash);
      return null;
    }
    return entry.pair;
  }

  /**
   * Rotate a refresh token.
   * Concurrent presents of the same token share one rotate (and a short grace
   * window) so polling races are not treated as theft. True reuse after grace
   * still revokes the whole family.
   */
  async rotate(rawRefresh: string): Promise<TokenPair> {
    const oldHash = this.hash(rawRefresh);

    const cached = this.gracePair(oldHash);
    if (cached) return cached;

    const existing = this.inflight.get(oldHash);
    if (existing) return existing;

    const run = this.rotateInner(rawRefresh, oldHash).finally(() => {
      this.inflight.delete(oldHash);
    });
    this.inflight.set(oldHash, run);
    return run;
  }

  private async rotateInner(rawRefresh: string, oldHash: string): Promise<TokenPair> {
    const cached = this.gracePair(oldHash);
    if (cached) return cached;

    const row = await this.em.findOne(
      RefreshTokenEntity,
      { tokenHash: oldHash },
      { populate: ['user', 'user.role'] },
    );
    if (!row) throw new UnauthorizedException('Invalid refresh token');

    if (row.revokedAt) {
      const grace = this.gracePair(oldHash);
      if (grace) return grace;

      // Outside grace: reuse of an already-rotated token → compromise.
      await this.em.nativeUpdate(
        RefreshTokenEntity,
        { familyId: row.familyId, revokedAt: null },
        { revokedAt: new Date() },
      );
      throw new UnauthorizedException('Refresh token reuse detected');
    }
    if (row.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    row.revokedAt = new Date();
    await this.em.flush();

    const pair = await this.issueWithFamily(this.subjectFromUser(row.user), row.familyId);
    this.rememberGrace(oldHash, pair);
    return pair;
  }

  /** Revoke a single presented refresh token (logout). */
  async revoke(rawRefresh: string): Promise<void> {
    await this.em.nativeUpdate(
      RefreshTokenEntity,
      { tokenHash: this.hash(rawRefresh) },
      { revokedAt: new Date() },
    );
  }

  /** Revoke every active refresh token for a user (e.g. after password change). */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.em.nativeUpdate(
      RefreshTokenEntity,
      { user: userId, revokedAt: null },
      { revokedAt: new Date() },
    );
  }
}
