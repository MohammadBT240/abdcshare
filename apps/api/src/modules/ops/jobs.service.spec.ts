import { ConflictException, NotFoundException } from '@nestjs/common';
import { OutboxStatus } from '@abdcshare/shared';
import { JobsService, OUTBOX_STALE_SECONDS, QUEUED_STUCK_SECONDS } from './jobs.service';
import { parseClamdVersion } from './clamd-probe';

function setup(opts: { stats?: { status: string; n: number; oldest: Date | null }[]; stuck?: number; row?: Record<string, unknown> | null } = {}) {
  const fork = {
    findOne: jest.fn(async () => opts.row ?? null),
    flush: jest.fn(async () => undefined),
  };
  const em = {
    execute: jest.fn(async (sql: string) => (sql.includes("status = 'Queued' and updated_at") ? [{ n: opts.stuck ?? 0 }] : (opts.stats ?? []))),
    find: jest.fn(async () => []),
    fork: () => fork,
  };
  const config = { get: (k: string, d?: unknown) => (k === 'CLAMD_HOST' ? undefined : d) };
  const redis = { ping: jest.fn(async () => 'PONG') };
  const service = new JobsService(em as never, config as never, null);
  (service as unknown as { redis: unknown }).redis = redis;
  return { service, em, fork, redis };
}

describe('parseClamdVersion', () => {
  it('reads the signature date', () => {
    const v = parseClamdVersion('ClamAV 1.4.3/27460/Wed Nov 11 09:25:02 2026\0');
    expect(v.version).toBe('ClamAV 1.4.3/27460/Wed Nov 11 09:25:02 2026');
    expect(v.signaturesAt?.getUTCFullYear()).toBe(2026);
    expect(parseClamdVersion('ClamAV 1.5.4').signaturesAt).toBeNull();
  });
});

describe('JobsService.opsHealth', () => {
  it('is ok with an empty outbox and Redis up', async () => {
    const { service } = setup();
    await expect(service.opsHealth()).resolves.toMatchObject({ status: 'ok' });
  });

  it('degrades when the oldest Pending row is stale, rows failed, or rows are stuck in Queued', async () => {
    const old = new Date(Date.now() - (OUTBOX_STALE_SECONDS + 60) * 1000);
    const { service } = setup({ stats: [{ status: 'Pending', n: 3, oldest: old }, { status: 'Failed', n: 1, oldest: null }], stuck: 2 });
    const h = await service.opsHealth();
    expect(h.status).toBe('degraded');
    expect(h.checks.filter((c) => !c.ok).map((c) => c.name).sort()).toEqual(['outbox_backlog', 'outbox_failed', 'outbox_stuck']);
  });
});

describe('JobsService.redriveOutbox', () => {
  it('puts a Failed row back to Pending and clears the error', async () => {
    const row = { id: 'r', status: OutboxStatus.Failed, lastError: 'boom', updatedAt: new Date() };
    const { service, fork } = setup({ row });
    await expect(service.redriveOutbox('r')).resolves.toEqual({ id: 'r', status: OutboxStatus.Pending });
    expect(row).toMatchObject({ status: OutboxStatus.Pending, lastError: null });
    expect(fork.flush).toHaveBeenCalled();
  });

  it('re-drives a row stuck in Queued, but not a recently queued or sent one', async () => {
    const stuck = { id: 'q', status: OutboxStatus.Queued, updatedAt: new Date(Date.now() - (QUEUED_STUCK_SECONDS + 5) * 1000) };
    await expect(setup({ row: stuck }).service.redriveOutbox('q')).resolves.toMatchObject({ status: OutboxStatus.Pending });
    const fresh = { id: 'q', status: OutboxStatus.Queued, updatedAt: new Date() };
    await expect(setup({ row: fresh }).service.redriveOutbox('q')).rejects.toBeInstanceOf(ConflictException);
    const sent = { id: 's', status: OutboxStatus.Sent, updatedAt: new Date(0) };
    await expect(setup({ row: sent }).service.redriveOutbox('s')).rejects.toBeInstanceOf(ConflictException);
    await expect(setup({ row: null }).service.redriveOutbox('x')).rejects.toBeInstanceOf(NotFoundException);
  });
});
