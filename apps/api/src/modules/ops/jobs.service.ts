import { ConflictException, Inject, Injectable, NotFoundException, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityManager } from '@mikro-orm/postgresql';
import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { OutboxStatus, QUEUE } from '@abdcshare/shared';
import { OutboxEntity } from '../outbox/infrastructure/persistence/outbox.entity';
import { OUTBOX_REDIS } from '../outbox/outbox.tokens';
import { probeClamd, type ClamdStatus } from './clamd-probe';

/** Outbox rows Pending for longer than this mean the publisher or Redis is stuck. */
export const OUTBOX_STALE_SECONDS = 10 * 60;
/** A row Queued this long was lost by the queue (e.g. the worker died mid-job) — it can be re-driven. */
export const QUEUED_STUCK_SECONDS = 15 * 60;
/** ClamAV signatures older than this mean freshclam has stopped updating. */
export const SIGNATURES_STALE_HOURS = 72;

export interface OutboxStats {
  pending: number;
  queued: number;
  failed: number;
  oldestPendingAgeSeconds: number | null;
  /** Rows Queued for longer than {@link QUEUED_STUCK_SECONDS}. */
  stuckQueued: number;
}

export interface OpsHealth {
  status: 'ok' | 'degraded';
  checks: { name: string; ok: boolean; detail: string }[];
  ts: string;
}

/**
 * Background-job visibility for Platform Admins (S4, S4-D2) and the public ops health check that
 * uptime monitors poll. Re-drives are audited by the global audit interceptor (POST).
 */
@Injectable()
export class JobsService implements OnModuleDestroy {
  private queue: Queue | null = null;

  constructor(
    private readonly em: EntityManager,
    private readonly config: ConfigService,
    @Optional() @Inject(OUTBOX_REDIS) private readonly redis: Redis | null,
  ) {
    if (redis) this.queue = new Queue(QUEUE.Notifications, { connection: redis });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
  }

  async outboxStats(): Promise<OutboxStats> {
    const rows = await this.em.execute<{ status: string; n: number; oldest: Date | null }[]>(
      `select status, count(*)::int as n, min(created_at) as oldest from outbox
        where status in ('Pending', 'Queued', 'Failed') group by status`,
    );
    const by = new Map(rows.map((r) => [r.status, r]));
    const oldest = by.get('Pending')?.oldest;
    const [stuck] = await this.em.execute<{ n: number }[]>(
      `select count(*)::int as n from outbox where status = 'Queued' and updated_at < now() - make_interval(secs => ?)`,
      [QUEUED_STUCK_SECONDS],
    );
    return {
      pending: Number(by.get('Pending')?.n ?? 0),
      queued: Number(by.get('Queued')?.n ?? 0),
      failed: Number(by.get('Failed')?.n ?? 0),
      oldestPendingAgeSeconds: oldest ? Math.round((Date.now() - new Date(oldest).getTime()) / 1000) : null,
      stuckQueued: Number(stuck?.n ?? 0),
    };
  }

  async clamd(): Promise<ClamdStatus | null> {
    const host = this.config.get<string>('CLAMD_HOST');
    if (!host) return null;
    return probeClamd(host, Number(this.config.get('CLAMD_PORT', 3310)));
  }

  async overview() {
    const counts = this.queue
      ? await this.queue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed', 'paused')
      : null;
    const failedJobs = this.queue
      ? (await this.queue.getFailed(0, 49)).map((j) => ({
          id: j.id ?? '',
          name: j.name,
          failedReason: j.failedReason ?? null,
          attemptsMade: j.attemptsMade,
          finishedOn: j.finishedOn ? new Date(j.finishedOn) : null,
        }))
      : [];
    const stuckBefore = new Date(Date.now() - QUEUED_STUCK_SECONDS * 1000);
    const failedOutbox = await this.em.find(
      OutboxEntity,
      { $or: [{ status: OutboxStatus.Failed }, { status: OutboxStatus.Queued, updatedAt: { $lt: stuckBefore } }] },
      { orderBy: { updatedAt: 'desc' }, limit: 50 },
    );
    return {
      queue: { name: QUEUE.Notifications, connected: Boolean(this.queue), counts },
      failedJobs,
      outbox: {
        ...(await this.outboxStats()),
        failedRows: failedOutbox.map((r) => ({
          id: r.id,
          status: r.status,
          eventType: r.eventType,
          lastError: r.lastError ?? null,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        })),
      },
      clamd: await this.clamd(),
      thresholds: {
        outboxStaleSeconds: OUTBOX_STALE_SECONDS,
        queuedStuckSeconds: QUEUED_STUCK_SECONDS,
        signaturesStaleHours: SIGNATURES_STALE_HOURS,
      },
    };
  }

  /**
   * Re-drive a Failed (or stuck Queued) outbox row: drop its spent BullMQ job (same jobId) and set it back to
   * Pending so the publisher queues it again on its next tick.
   */
  async redriveOutbox(id: string): Promise<{ id: string; status: OutboxStatus }> {
    const em = this.em.fork();
    const row = await em.findOne(OutboxEntity, { id });
    if (!row) throw new NotFoundException('Outbox row not found');
    const stuck = row.status === OutboxStatus.Queued && Date.now() - row.updatedAt.getTime() > QUEUED_STUCK_SECONDS * 1000;
    if (row.status !== OutboxStatus.Failed && !stuck) {
      throw new ConflictException(`Only Failed rows (or rows stuck in Queued) can be re-driven — this one is ${row.status}`);
    }
    const job = this.queue ? await this.queue.getJob(id) : null;
    if (job) await job.remove();
    row.status = OutboxStatus.Pending;
    row.lastError = null;
    await em.flush();
    return { id: row.id, status: row.status };
  }

  /** Public, data-free health for uptime monitors: 503 when anything needs a human. */
  async opsHealth(): Promise<OpsHealth> {
    const checks: OpsHealth['checks'] = [];
    try {
      const o = await this.outboxStats();
      const stale = o.oldestPendingAgeSeconds != null && o.oldestPendingAgeSeconds > OUTBOX_STALE_SECONDS;
      checks.push({
        name: 'outbox_backlog',
        ok: !stale,
        detail: o.oldestPendingAgeSeconds == null ? 'empty' : `oldest pending ${o.oldestPendingAgeSeconds}s`,
      });
      checks.push({ name: 'outbox_failed', ok: o.failed === 0, detail: `${o.failed} failed` });
      checks.push({ name: 'outbox_stuck', ok: o.stuckQueued === 0, detail: `${o.stuckQueued} stuck in Queued` });
    } catch (err) {
      checks.push({ name: 'database', ok: false, detail: err instanceof Error ? err.message : 'unreachable' });
    }
    if (this.redis) {
      const pong = await this.redis.ping().catch(() => null);
      checks.push({ name: 'redis', ok: pong === 'PONG', detail: pong ?? 'unreachable' });
    }
    const clamd = await this.clamd();
    if (clamd) {
      const ageH = clamd.signaturesAt ? (Date.now() - clamd.signaturesAt.getTime()) / 3_600_000 : null;
      checks.push({ name: 'clamd', ok: clamd.reachable, detail: clamd.reachable ? (clamd.version ?? '') : (clamd.error ?? 'down') });
      checks.push({
        name: 'clamd_signatures',
        ok: ageH != null && ageH <= SIGNATURES_STALE_HOURS,
        detail: ageH == null ? 'unknown' : `${Math.round(ageH)}h old`,
      });
    }
    return { status: checks.every((c) => c.ok) ? 'ok' : 'degraded', checks, ts: new Date().toISOString() };
  }
}
