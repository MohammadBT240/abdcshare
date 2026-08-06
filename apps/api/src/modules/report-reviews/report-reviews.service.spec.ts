import { DocumentStatus, ReportReviewDecision, ReportReviewState } from '@abdcshare/shared';
import { ReportReviewsService } from './report-reviews.service';
import { DocumentEntity } from '../documents/infrastructure/persistence/document.entity';
import { DocumentFileEntity } from '../documents/infrastructure/persistence/document-file.entity';
import { ReportReviewCycleEntity } from './infrastructure/persistence/report-review-cycle.entity';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';

const client = {
  userId: 'client-1',
  email: '',
  role: 'Client',
  clientId: 'c1',
  mustChangePassword: false,
} as AuthenticatedUser;

const sa = {
  userId: 'sa-1',
  email: '',
  role: 'Super Admin',
  mustChangePassword: false,
} as AuthenticatedUser;

function build(doc: Record<string, unknown>, cycle: Record<string, unknown> | null) {
  const em = {
    findOne: jest.fn(async (entity: unknown) =>
      entity === DocumentEntity ? doc : entity === ReportReviewCycleEntity ? cycle : null,
    ),
    find: jest.fn(async (entity: unknown) => {
      if (entity === ReportReviewCycleEntity) return cycle ? [cycle] : [];
      if (entity === DocumentFileEntity) return [];
      return [];
    }),
    getReference: jest.fn((_e: unknown, id: unknown) => ({ id })),
    flush: jest.fn(async () => undefined),
    create: jest.fn(),
  };
  const service = new ReportReviewsService(
    em as never,
    { enqueue: jest.fn() } as never,
    { emit: jest.fn(async () => undefined) } as never,
    { presignDownload: jest.fn(), presignUpload: jest.fn() } as never,
  );
  return { em, service };
}

const baseDoc = () => ({
  id: 'd1',
  title: 'FY25 Report',
  status: DocumentStatus.Ready,
  currentVersion: 1,
  clientReviewState: ReportReviewState.AwaitingClient,
  engagement: {
    id: 'e1',
    referenceCode: 'ENG-1',
    title: 'Statutory Audit',
    team: { getItems: () => [] },
  },
});

describe('ReportReviewsService.respond', () => {
  it('client approval finalises the report (SignedOff)', async () => {
    const doc = { ...baseDoc(), clientReviewRound: 1 };
    const cycle = {
      roundNo: 1,
      fileVersion: 1,
      decision: ReportReviewDecision.Pending,
      sentAt: new Date(),
    };
    const { service } = build(doc, cycle);

    const result = await service.respond('d1', { decision: ReportReviewDecision.Approved }, client);

    expect(doc.clientReviewState).toBe(ReportReviewState.Approved);
    expect(doc.status).toBe(DocumentStatus.SignedOff);
    expect(cycle.decision).toBe(ReportReviewDecision.Approved);
    expect(result.reviewState).toBe(ReportReviewState.Approved);
    expect(result.engagementReferenceCode).toBe('ENG-1');
  });

  it('changes requested on round < 3 → ChangesRequested', async () => {
    const doc = { ...baseDoc(), clientReviewRound: 1 };
    const cycle = {
      roundNo: 1,
      fileVersion: 1,
      decision: ReportReviewDecision.Pending,
      sentAt: new Date(),
    };
    const { service } = build(doc, cycle);

    await service.respond(
      'd1',
      { decision: ReportReviewDecision.ChangesRequested, feedback: 'fix p.3' },
      client,
    );

    expect(doc.clientReviewState).toBe(ReportReviewState.ChangesRequested);
    expect(doc.status).toBe(DocumentStatus.Ready);
  });

  it('changes requested on the 3rd round → Locked', async () => {
    const doc = { ...baseDoc(), clientReviewRound: 3 };
    const cycle = {
      roundNo: 3,
      fileVersion: 3,
      decision: ReportReviewDecision.Pending,
      sentAt: new Date(),
    };
    const { service } = build(doc, cycle);

    await service.respond(
      'd1',
      { decision: ReportReviewDecision.ChangesRequested, feedback: 'still wrong' },
      client,
    );

    expect(doc.clientReviewState).toBe(ReportReviewState.Locked);
  });
});

describe('ReportReviewsService.sendToClient', () => {
  it('blocks resend when ChangesRequested without a newer file version', async () => {
    const doc = {
      ...baseDoc(),
      clientReviewRound: 1,
      clientReviewState: ReportReviewState.ChangesRequested,
      currentVersion: 1,
    };
    const cycle = {
      roundNo: 1,
      fileVersion: 1,
      decision: ReportReviewDecision.ChangesRequested,
      sentAt: new Date(),
      feedback: 'fix p.3',
    };
    const { service } = build(doc, cycle);

    await expect(service.sendToClient('d1', sa)).rejects.toThrow(
      'Upload a revised file before sending again',
    );
  });

  it('allows resend after a newer file version is uploaded', async () => {
    const doc = {
      ...baseDoc(),
      clientReviewRound: 1,
      clientReviewState: ReportReviewState.ChangesRequested,
      currentVersion: 2,
    };
    const cycle = {
      roundNo: 1,
      fileVersion: 1,
      decision: ReportReviewDecision.ChangesRequested,
      sentAt: new Date(),
      feedback: 'fix p.3',
    };
    const { em, service } = build(doc, cycle);

    const result = await service.sendToClient('d1', sa);

    expect(doc.clientReviewState).toBe(ReportReviewState.AwaitingClient);
    expect(doc.clientReviewRound).toBe(2);
    expect(em.create).toHaveBeenCalled();
    expect(result.reviewRound).toBe(2);
  });
});
