import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, type FilterQuery } from '@mikro-orm/postgresql';
import { EVENT, type Paginated } from '@abdcshare/shared';
import { pageParams, paginated } from '../../common/pagination/paginate';
import { OutboxService } from '../outbox/outbox.service';
import { UserEntity } from '../users/infrastructure/persistence/user.entity';
import { NotificationEntity } from './infrastructure/persistence/notification.entity';
import { NotificationPreferenceEntity } from './infrastructure/persistence/notification-preference.entity';
import type {
  NotificationListQueryDto,
  UpdatePreferenceDto,
} from './presentation/dto/notification.dto';
import { NotificationResponseDto } from './presentation/dto/notification.dto';

export interface NotifyRecipient {
  userId: string;
  email?: string | null;
}

export interface NotifyInput {
  recipients: NotifyRecipient[];
  type: string;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
  link?: string;
  /** Exclude this user (usually the actor) from their own notification. */
  excludeUserId?: string;
}

interface EmailJob {
  notificationId?: string;
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly em: EntityManager,
    private readonly outbox: OutboxService,
  ) {}

  private toDto(n: NotificationEntity): NotificationResponseDto {
    return {
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body ?? null,
      entityType: n.entityType ?? null,
      entityId: n.entityId ?? null,
      link: n.link ?? null,
      isRead: n.isRead,
      readAt: n.readAt ?? null,
      createdAt: n.createdAt,
    };
  }

  /**
   * Fan-out: create in-app rows (respecting prefs) and enqueue a single email job
   * for the worker. Persists within the caller's unit of work — the caller flushes.
   */
  async emit(input: NotifyInput): Promise<void> {
    const recipients = input.recipients.filter(
      (r, i, arr) =>
        r.userId !== input.excludeUserId && arr.findIndex((x) => x.userId === r.userId) === i,
    );
    if (recipients.length === 0) return;

    const userIds = recipients.map((r) => r.userId);
    const prefs = await this.em.find(NotificationPreferenceEntity, {
      user: { $in: userIds },
      notificationType: input.type,
    } as FilterQuery<NotificationPreferenceEntity>);
    const prefByUser = new Map(prefs.map((p) => [p.user.id, p]));

    const emails: EmailJob[] = [];
    for (const r of recipients) {
      const pref = prefByUser.get(r.userId);
      const inApp = pref?.inAppEnabled ?? true;
      const email = pref?.emailEnabled ?? true;
      let notificationId: string | undefined;
      if (inApp) {
        const row = this.em.create(NotificationEntity, {
          user: this.em.getReference(UserEntity, r.userId),
          type: input.type,
          title: input.title,
          body: input.body ?? null,
          entityType: input.entityType ?? null,
          entityId: input.entityId ?? null,
          link: input.link ?? null,
          isRead: false,
          emailSent: false,
        });
        notificationId = row.id;
      }
      if (email && r.email) {
        emails.push({
          notificationId,
          to: r.email,
          subject: input.title,
          html: `<p>${input.body ?? input.title}</p>${input.link ? `<p><a href="${input.link}">Open</a></p>` : ''}`,
        });
      }
    }
    if (emails.length > 0) {
      this.outbox.enqueue(EVENT.NotificationEmail, { emails });
    }
  }

  async listMine(
    userId: string,
    query: NotificationListQueryDto,
  ): Promise<Paginated<NotificationResponseDto>> {
    const where: Record<string, unknown> = { user: userId };
    if (query.unread === 'true') where.isRead = false;
    const { page, pageSize, limit, offset } = pageParams(query);
    const [rows, total] = await this.em.findAndCount(
      NotificationEntity,
      where as FilterQuery<NotificationEntity>,
      { orderBy: { createdAt: 'desc', id: 'asc' }, limit, offset },
    );
    return paginated(rows.map((n) => this.toDto(n)), total, page, pageSize);
  }

  async unreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.em.count(NotificationEntity, { user: userId, isRead: false });
    return { count };
  }

  async markRead(id: string, userId: string): Promise<NotificationResponseDto> {
    const n = await this.em.findOne(NotificationEntity, { id, user: userId });
    if (!n) throw new NotFoundException('Notification not found');
    if (!n.isRead) {
      n.isRead = true;
      n.readAt = new Date();
      await this.em.flush();
    }
    return this.toDto(n);
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const updated = await this.em.nativeUpdate(
      NotificationEntity,
      { user: userId, isRead: false },
      { isRead: true, readAt: new Date() },
    );
    return { updated };
  }

  async getPreferences(userId: string): Promise<NotificationPreferenceEntity[]> {
    return this.em.find(NotificationPreferenceEntity, { user: userId });
  }

  async setPreference(
    userId: string,
    notificationType: string,
    dto: UpdatePreferenceDto,
  ): Promise<NotificationPreferenceEntity> {
    let pref = await this.em.findOne(NotificationPreferenceEntity, {
      user: userId,
      notificationType,
    });
    if (!pref) {
      pref = this.em.create(NotificationPreferenceEntity, {
        user: this.em.getReference(UserEntity, userId),
        notificationType,
      });
    }
    if (dto.emailEnabled != null) pref.emailEnabled = dto.emailEnabled;
    if (dto.inAppEnabled != null) pref.inAppEnabled = dto.inAppEnabled;
    await this.em.flush();
    return pref;
  }
}
