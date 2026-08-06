import { EVENT } from '@abdcshare/shared';
import { NotificationsService } from './notifications.service';
import { NotificationEntity } from './infrastructure/persistence/notification.entity';

describe('NotificationsService.emit', () => {
  it('dedupes recipients, excludes the actor, creates in-app rows and one email job', async () => {
    const created: unknown[] = [];
    const em = {
      find: jest.fn(async () => []), // no prefs → defaults (in-app + email on)
      getReference: jest.fn((_e: unknown, id: unknown) => ({ id })),
      create: jest.fn((entity: unknown, data: Record<string, unknown>) => {
        const row = { id: `n-${created.length}`, ...data };
        if (entity === NotificationEntity) created.push(row);
        return row;
      }),
    };
    const outbox = { enqueue: jest.fn() };
    const service = new NotificationsService(em as never, outbox as never);

    await service.emit({
      recipients: [
        { userId: 'a', email: 'a@x.com' },
        { userId: 'a', email: 'a@x.com' }, // duplicate
        { userId: 'actor', email: 'actor@x.com' }, // excluded
      ],
      type: 'discussion.message',
      title: 'New message',
      excludeUserId: 'actor',
    });

    expect(created).toHaveLength(1); // only user "a", once
    expect(outbox.enqueue).toHaveBeenCalledWith(EVENT.NotificationEmail, expect.any(Object));
  });

  it('does nothing when the only recipient is the actor', async () => {
    const em = { find: jest.fn(async () => []), getReference: jest.fn(), create: jest.fn() };
    const outbox = { enqueue: jest.fn() };
    const service = new NotificationsService(em as never, outbox as never);
    await service.emit({
      recipients: [{ userId: 'actor' }],
      type: 't',
      title: 'x',
      excludeUserId: 'actor',
    });
    expect(em.create).not.toHaveBeenCalled();
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('honors channels: in-app without email when channels.email is false', async () => {
    const created: unknown[] = [];
    const em = {
      find: jest.fn(async () => []),
      getReference: jest.fn((_e: unknown, id: unknown) => ({ id })),
      create: jest.fn((entity: unknown, data: Record<string, unknown>) => {
        const row = { id: `n-${created.length}`, ...data };
        if (entity === NotificationEntity) created.push(row);
        return row;
      }),
    };
    const outbox = { enqueue: jest.fn() };
    const service = new NotificationsService(em as never, outbox as never);

    await service.emit({
      recipients: [
        {
          userId: 'c1',
          email: 'c@x.com',
          channels: { inApp: true, email: false },
        },
      ],
      type: 'request.created',
      title: 'New request',
    });

    expect(created).toHaveLength(1);
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });
});
