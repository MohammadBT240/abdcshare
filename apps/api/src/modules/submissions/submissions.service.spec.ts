import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { SubmissionStatus } from '@abdcshare/shared';
import { SubmissionsService } from './submissions.service';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';

jest.mock('../requests/request-stage-sync', () => ({
  syncInferredRequestStage: jest.fn(async () => null),
}));

const reviewer = {
  userId: 'reviewer-1',
  email: '',
  role: 'Super Admin',
  mustChangePassword: false,
} as AuthenticatedUser;

const client = {
  userId: 'client-1',
  email: 'c@x.com',
  role: 'Client',
  clientId: 'org-1',
  mustChangePassword: false,
} as AuthenticatedUser;

const notifications = { emit: jest.fn(async () => undefined) };

function storageStub(extra: Record<string, unknown> = {}) {
  return {
    presignUpload: jest.fn(),
    presignDownload: jest.fn(),
    upload: jest.fn(),
    createMultipart: jest.fn(),
    presignPart: jest.fn(),
    completeMultipart: jest.fn(),
    abortMultipart: jest.fn(),
    head: jest.fn(),
    getObject: jest.fn(),
    getObjectRange: jest.fn(),
    ...extra,
  };
}

function file(partial: Record<string, unknown>) {
  return {
    id: partial.id ?? 'f1',
    status: partial.status ?? SubmissionStatus.Pending,
    fileName: partial.fileName ?? 'a.pdf',
    reviewReason: null,
    reviewedBy: null,
    reviewedAt: null,
    replacesFile: partial.replacesFile ?? null,
    ...partial,
  };
}

function submissionWithFiles(files: ReturnType<typeof file>[], status = SubmissionStatus.Pending) {
  return {
    id: 's1',
    status,
    message: 'hello',
    submittedBy: { id: 'client-1', email: 'c@x.com' },
    request: {
      id: 'r1',
      engagement: {
        id: 'e1',
        team: { getItems: () => [{ user: { id: 'staff-1', email: 's@x.com' } }] },
      },
    },
    files: { getItems: () => files },
    reviewedBy: null,
    reviewedAt: null,
    reviewReason: null,
  };
}

describe('SubmissionsService.finalize', () => {
  beforeEach(() => notifications.emit.mockClear());

  it('rejects finalize with zero files', async () => {
    const submission = submissionWithFiles([], SubmissionStatus.Draft);
    const em = {
      findOne: jest.fn(async () => submission),
      flush: jest.fn(),
      populate: jest.fn(),
      getReference: jest.fn((_e: unknown, id: unknown) => ({ id })),
    };
    const service = new SubmissionsService(em as never, notifications as never, { enqueue: jest.fn() } as never, storageStub() as never);
    await expect(service.finalize('s1', client)).rejects.toBeInstanceOf(BadRequestException);
    expect(notifications.emit).not.toHaveBeenCalled();
  });

  it('finalize promotes Draft → Pending and notifies staff', async () => {
    const files = [file({ id: 'f1', status: SubmissionStatus.Draft })];
    const submission = submissionWithFiles(files, SubmissionStatus.Draft);
    const em = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(submission)
        .mockResolvedValueOnce({ createdBy: { id: 'creator-1', email: 'c@x.com' } }),
      find: jest.fn(async () => [
        { user: { id: 'staff-1', email: 's@x.com' } },
      ]),
      populate: jest.fn(async () => undefined),
      flush: jest.fn(async () => undefined),
      getReference: jest.fn((_e: unknown, id: unknown) => ({ id })),
    };
    const service = new SubmissionsService(em as never, notifications as never, { enqueue: jest.fn() } as never, storageStub() as never);
    jest.spyOn(service, 'getOne').mockResolvedValue({ id: 's1', status: SubmissionStatus.Pending } as never);

    await service.finalize('s1', client);

    expect(submission.status).toBe(SubmissionStatus.Pending);
    expect(notifications.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'submission.created',
        recipients: expect.arrayContaining([
          { userId: 'staff-1', email: 's@x.com' },
          { userId: 'creator-1', email: 'c@x.com' },
        ]),
      }),
    );
  });

  it('finalize is idempotent when already Pending', async () => {
    const files = [file({ id: 'f1', status: SubmissionStatus.Pending })];
    const submission = submissionWithFiles(files, SubmissionStatus.Pending);
    const em = {
      findOne: jest.fn(async () => submission),
      flush: jest.fn(),
      populate: jest.fn(),
      getReference: jest.fn((_e: unknown, id: unknown) => ({ id })),
    };
    const service = new SubmissionsService(em as never, notifications as never, { enqueue: jest.fn() } as never, storageStub() as never);
    jest.spyOn(service, 'getOne').mockResolvedValue({ id: 's1', status: SubmissionStatus.Pending } as never);

    await service.finalize('s1', client);

    expect(notifications.emit).not.toHaveBeenCalled();
  });

  it('create does not notify (draft is silent)', async () => {
    const request = {
      id: 'r1',
      engagement: { team: { getItems: () => [] } },
    };
    const created = { id: 's-new' };
    const em = {
      findOne: jest.fn(async () => request),
      create: jest.fn(() => created),
      getReference: jest.fn((_e: unknown, id: unknown) => ({ id })),
      persistAndFlush: jest.fn(async () => undefined),
    };
    const service = new SubmissionsService(em as never, notifications as never, { enqueue: jest.fn() } as never, storageStub() as never);
    jest.spyOn(service, 'getOne').mockResolvedValue({ id: 's-new', status: SubmissionStatus.Draft } as never);

    await service.create('r1', { message: 'draft msg' }, client);

    expect(em.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: SubmissionStatus.Draft }),
    );
    expect(notifications.emit).not.toHaveBeenCalled();
  });
});

describe('SubmissionsService.confirmFile progressive publish', () => {
  beforeEach(() => notifications.emit.mockClear());

  it('first file on Draft promotes to Pending and notifies staff', async () => {
    const submission = submissionWithFiles([], SubmissionStatus.Draft);
    const created: Record<string, unknown> = {};
    const em = {
      findOne: jest.fn(async (_entity: unknown, where: { id?: string }) => {
        if (where?.id === 'e1') {
          return { createdBy: { id: 'creator-1', email: 'c@x.com' } };
        }
        return submission;
      }),
      find: jest.fn(async () => [{ user: { id: 'staff-1', email: 's@x.com' } }]),
      create: jest.fn((_e: unknown, data: Record<string, unknown>) => {
        Object.assign(created, data, { id: 'new' });
        const next = [
          {
            id: 'new',
            status: SubmissionStatus.Pending,
            fileName: data.fileName,
            replacesFile: null,
          },
        ];
        submission.files.getItems = () => next as never;
        return created;
      }),
      getReference: jest.fn((_e: unknown, id: unknown) => ({ id })),
      flush: jest.fn(async () => undefined),
      populate: jest.fn(async () => undefined),
    };
    const service = new SubmissionsService(em as never, notifications as never, { enqueue: jest.fn() } as never, storageStub() as never);
    jest.spyOn(service, 'getOne').mockResolvedValue({ id: 's1', status: SubmissionStatus.Pending } as never);

    await service.confirmFile(
      's1',
      { storageKey: 'k', fileName: 'first.pdf' },
      client,
    );

    expect(submission.status).toBe(SubmissionStatus.Pending);
    expect(created.status).toBe(SubmissionStatus.Pending);
    expect(notifications.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'submission.created',
        title: 'A client responded to a request',
      }),
    );
  });

  it('additional file on Pending notifies as added file', async () => {
    const existing = file({ id: 'f1', status: SubmissionStatus.Pending });
    const submission = submissionWithFiles([existing], SubmissionStatus.Pending);
    const created: Record<string, unknown> = {};
    const em = {
      findOne: jest.fn(async (_entity: unknown, where: { id?: string }) => {
        if (where?.id === 'e1') {
          return { createdBy: { id: 'creator-1', email: 'c@x.com' } };
        }
        return submission;
      }),
      find: jest.fn(async () => [{ user: { id: 'staff-1', email: 's@x.com' } }]),
      create: jest.fn((_e: unknown, data: Record<string, unknown>) => {
        Object.assign(created, data, { id: 'f2' });
        submission.files.getItems = () =>
          [
            existing,
            { id: 'f2', status: SubmissionStatus.Pending, fileName: data.fileName, replacesFile: null },
          ] as never;
        return created;
      }),
      getReference: jest.fn((_e: unknown, id: unknown) => ({ id })),
      flush: jest.fn(async () => undefined),
      populate: jest.fn(async () => undefined),
    };
    const service = new SubmissionsService(em as never, notifications as never, { enqueue: jest.fn() } as never, storageStub() as never);
    jest.spyOn(service, 'getOne').mockResolvedValue({ id: 's1' } as never);

    await service.confirmFile(
      's1',
      { storageKey: 'k2', fileName: 'second.pdf' },
      client,
    );

    expect(created.status).toBe(SubmissionStatus.Pending);
    expect(notifications.emit).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Client added a file to a response' }),
    );
  });
});

describe('SubmissionsService.reviewFile / derived status', () => {
  beforeEach(() => notifications.emit.mockClear());

  it('accepting all current files derives Accepted and notifies once', async () => {
    const f1 = file({ id: 'f1', status: SubmissionStatus.Pending });
    const f2 = file({ id: 'f2', status: SubmissionStatus.Pending });
    const submission = submissionWithFiles([f1, f2]);
    const em = {
      findOne: jest.fn(async () => submission),
      getReference: jest.fn((_e: unknown, id: unknown) => ({ id })),
      flush: jest.fn(async () => undefined),
      populate: jest.fn(),
    };
    const service = new SubmissionsService(em as never, notifications as never, { enqueue: jest.fn() } as never, storageStub() as never);
    jest.spyOn(service, 'getOne').mockResolvedValue({ id: 's1' } as never);

    await service.reviewFile('s1', 'f1', { decision: SubmissionStatus.Accepted }, reviewer);
    expect(submission.status).toBe(SubmissionStatus.Pending); // still one pending
    expect(notifications.emit).not.toHaveBeenCalled();

    await service.reviewFile('s1', 'f2', { decision: SubmissionStatus.Accepted }, reviewer);
    expect(submission.status).toBe(SubmissionStatus.Accepted);
    expect(notifications.emit).toHaveBeenCalledTimes(1);
    expect(notifications.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'submission.reviewed' }),
    );
  });

  it('returning one file derives Returned', async () => {
    const f1 = file({ id: 'f1', status: SubmissionStatus.Pending });
    const f2 = file({ id: 'f2', status: SubmissionStatus.Pending });
    const submission = submissionWithFiles([f1, f2]);
    const em = {
      findOne: jest.fn(async () => submission),
      getReference: jest.fn((_e: unknown, id: unknown) => ({ id })),
      flush: jest.fn(async () => undefined),
    };
    const service = new SubmissionsService(em as never, notifications as never, { enqueue: jest.fn() } as never, storageStub() as never);
    jest.spyOn(service, 'getOne').mockResolvedValue({ id: 's1' } as never);

    await service.reviewFile(
      's1',
      'f1',
      { decision: SubmissionStatus.Returned, reason: 'missing pages' },
      reviewer,
    );

    expect(f1.status).toBe(SubmissionStatus.Returned);
    expect(f1.reviewReason).toBe('missing pages');
    expect(submission.status).toBe(SubmissionStatus.Returned);
  });

  it('rejects return without reason', async () => {
    const f1 = file({ id: 'f1' });
    const submission = submissionWithFiles([f1]);
    const em = {
      findOne: jest.fn(async () => submission),
      getReference: jest.fn(),
      flush: jest.fn(),
    };
    const service = new SubmissionsService(em as never, notifications as never, { enqueue: jest.fn() } as never, storageStub() as never);
    await expect(
      service.reviewFile('s1', 'f1', { decision: SubmissionStatus.Returned }, reviewer),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('bulk review applies to all pending and under-review current files', async () => {
    const f1 = file({ id: 'f1' });
    const f2 = file({ id: 'f2', status: SubmissionStatus.UnderReview });
    const submission = submissionWithFiles([f1, f2]);
    const em = {
      findOne: jest.fn(async () => submission),
      getReference: jest.fn((_e: unknown, id: unknown) => ({ id })),
      flush: jest.fn(async () => undefined),
    };
    const service = new SubmissionsService(em as never, notifications as never, { enqueue: jest.fn() } as never, storageStub() as never);
    jest.spyOn(service, 'getOne').mockResolvedValue({ id: 's1' } as never);

    await service.review('s1', { decision: SubmissionStatus.Accepted }, reviewer);

    expect(f1.status).toBe(SubmissionStatus.Accepted);
    expect(f2.status).toBe(SubmissionStatus.Accepted);
    expect(submission.status).toBe(SubmissionStatus.Accepted);
  });

  it('startReview moves Pending → UnderReview and is idempotent', async () => {
    const f1 = file({ id: 'f1', status: SubmissionStatus.Pending });
    const submission = submissionWithFiles([f1]);
    const em = {
      findOne: jest.fn(async () => submission),
      getReference: jest.fn((_e: unknown, id: unknown) => ({ id })),
      flush: jest.fn(async () => undefined),
    };
    const service = new SubmissionsService(
      em as never,
      notifications as never,
      { enqueue: jest.fn() } as never,
      storageStub() as never,
    );
    jest.spyOn(service, 'getOne').mockResolvedValue({ id: 's1' } as never);

    await service.startReview('s1', 'f1', reviewer);
    expect(f1.status).toBe(SubmissionStatus.UnderReview);
    expect(submission.status).toBe(SubmissionStatus.UnderReview);
    expect(notifications.emit).not.toHaveBeenCalled();

    await service.startReview('s1', 'f1', reviewer);
    expect(f1.status).toBe(SubmissionStatus.UnderReview);
  });

  it('reviewFile accepts UnderReview files', async () => {
    const f1 = file({ id: 'f1', status: SubmissionStatus.UnderReview });
    const submission = submissionWithFiles([f1]);
    const em = {
      findOne: jest.fn(async () => submission),
      getReference: jest.fn((_e: unknown, id: unknown) => ({ id })),
      flush: jest.fn(async () => undefined),
    };
    const service = new SubmissionsService(
      em as never,
      notifications as never,
      { enqueue: jest.fn() } as never,
      storageStub() as never,
    );
    jest.spyOn(service, 'getOne').mockResolvedValue({ id: 's1' } as never);

    await service.reviewFile('s1', 'f1', { decision: SubmissionStatus.Accepted }, reviewer);
    expect(f1.status).toBe(SubmissionStatus.Accepted);
    expect(submission.status).toBe(SubmissionStatus.Accepted);
  });

  it('undoAcceptFile moves Accepted → UnderReview without notifying', async () => {
    const f1 = file({
      id: 'f1',
      status: SubmissionStatus.Accepted,
      reviewReason: 'ok',
    });
    const submission = submissionWithFiles([f1], SubmissionStatus.Accepted);
    const em = {
      findOne: jest.fn(async () => submission),
      getReference: jest.fn((_e: unknown, id: unknown) => ({ id })),
      flush: jest.fn(async () => undefined),
    };
    const service = new SubmissionsService(
      em as never,
      notifications as never,
      { enqueue: jest.fn() } as never,
      storageStub() as never,
    );
    jest.spyOn(service, 'getOne').mockResolvedValue({ id: 's1' } as never);

    await service.undoAcceptFile('s1', 'f1', reviewer);

    expect(f1.status).toBe(SubmissionStatus.UnderReview);
    expect(f1.reviewReason).toBeNull();
    expect(submission.status).toBe(SubmissionStatus.UnderReview);
    expect(notifications.emit).not.toHaveBeenCalled();
  });

  it('reopenFile moves Accepted → UnderReview with reason and notifies', async () => {
    const f1 = file({ id: 'f1', status: SubmissionStatus.Accepted, fileName: 'a.pdf' });
    const submission = submissionWithFiles([f1], SubmissionStatus.Accepted);
    const em = {
      findOne: jest.fn(async () => submission),
      getReference: jest.fn((_e: unknown, id: unknown) => ({ id })),
      flush: jest.fn(async () => undefined),
    };
    const service = new SubmissionsService(
      em as never,
      notifications as never,
      { enqueue: jest.fn() } as never,
      storageStub() as never,
    );
    jest.spyOn(service, 'getOne').mockResolvedValue({ id: 's1' } as never);

    await service.reopenFile('s1', 'f1', { reason: 'Need another look' }, reviewer);

    expect(f1.status).toBe(SubmissionStatus.UnderReview);
    expect(f1.reviewReason).toBe('Need another look');
    expect(submission.status).toBe(SubmissionStatus.UnderReview);
    expect(notifications.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'submission.reviewed' }),
    );
  });

  it('reopenFile rejects non-accepted files', async () => {
    const f1 = file({ id: 'f1', status: SubmissionStatus.Pending });
    const submission = submissionWithFiles([f1]);
    const em = {
      findOne: jest.fn(async () => submission),
      getReference: jest.fn(),
      flush: jest.fn(),
    };
    const service = new SubmissionsService(
      em as never,
      notifications as never,
      { enqueue: jest.fn() } as never,
      storageStub() as never,
    );
    await expect(
      service.reopenFile('s1', 'f1', { reason: 'oops' }, reviewer),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('undoReturnFile moves Returned → UnderReview with reason and notifies', async () => {
    const f1 = file({
      id: 'f1',
      status: SubmissionStatus.Returned,
      fileName: 'a.pdf',
      reviewReason: 'Wrong version',
    });
    const submission = submissionWithFiles([f1], SubmissionStatus.Returned);
    const em = {
      findOne: jest.fn(async () => submission),
      getReference: jest.fn((_e: unknown, id: unknown) => ({ id })),
      flush: jest.fn(async () => undefined),
    };
    const service = new SubmissionsService(
      em as never,
      notifications as never,
      { enqueue: jest.fn() } as never,
      storageStub() as never,
    );
    jest.spyOn(service, 'getOne').mockResolvedValue({ id: 's1' } as never);

    await service.undoReturnFile('s1', 'f1', { reason: 'Return was a mistake' }, reviewer);

    expect(f1.status).toBe(SubmissionStatus.UnderReview);
    expect(f1.reviewReason).toBe('Return was a mistake');
    expect(submission.status).toBe(SubmissionStatus.UnderReview);
    expect(notifications.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'submission.reviewed' }),
    );
  });

  it('UnderReview wins over Returned when deriving parent status', async () => {
    const f1 = file({ id: 'f1', status: SubmissionStatus.Returned });
    const f2 = file({ id: 'f2', status: SubmissionStatus.Pending });
    const submission = submissionWithFiles([f1, f2], SubmissionStatus.Returned);
    const em = {
      findOne: jest.fn(async () => submission),
      getReference: jest.fn((_e: unknown, id: unknown) => ({ id })),
      flush: jest.fn(async () => undefined),
    };
    const service = new SubmissionsService(
      em as never,
      notifications as never,
      { enqueue: jest.fn() } as never,
      storageStub() as never,
    );
    jest.spyOn(service, 'getOne').mockResolvedValue({ id: 's1' } as never);

    await service.startReview('s1', 'f2', reviewer);

    expect(f2.status).toBe(SubmissionStatus.UnderReview);
    expect(submission.status).toBe(SubmissionStatus.UnderReview);
  });
});

describe('SubmissionsService.confirmFile replacement', () => {
  beforeEach(() => notifications.emit.mockClear());

  it('replacement of Returned file resets status to Pending and notifies staff', async () => {
    const old = file({ id: 'old', status: SubmissionStatus.Returned });
    const submission = submissionWithFiles([old], SubmissionStatus.Returned);
    const created: Record<string, unknown> = {};
    const em = {
      findOne: jest.fn(async (_entity: unknown, where: { id?: string }) => {
        if (where?.id === 'e1') {
          return { createdBy: { id: 'creator-1', email: 'c@x.com' } };
        }
        return submission;
      }),
      find: jest.fn(async () => [{ user: { id: 'staff-1', email: 's@x.com' } }]),
      create: jest.fn((_e: unknown, data: Record<string, unknown>) => {
        Object.assign(created, data, { id: 'new' });
        // Simulate collection update: add new file that replaces old
        const next = [
          old,
          {
            id: 'new',
            status: SubmissionStatus.Pending,
            replacesFile: old,
            fileName: data.fileName,
          },
        ];
        submission.files.getItems = () => next as never;
        return created;
      }),
      getReference: jest.fn((_e: unknown, id: unknown) => ({ id })),
      flush: jest.fn(async () => undefined),
      populate: jest.fn(async () => undefined),
    };
    const service = new SubmissionsService(em as never, notifications as never, { enqueue: jest.fn() } as never, storageStub() as never);
    jest.spyOn(service, 'getOne').mockResolvedValue({ id: 's1' } as never);

    await service.confirmFile(
      's1',
      {
        storageKey: 'k',
        fileName: 'fixed.pdf',
        replacesFileId: 'old',
      },
      client,
    );

    expect(submission.status).toBe(SubmissionStatus.Pending);
    expect(notifications.emit).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'A client resubmitted a file' }),
    );
  });

  it('rejects replacement of non-Returned file', async () => {
    const old = file({ id: 'old', status: SubmissionStatus.Pending });
    const submission = submissionWithFiles([old], SubmissionStatus.Pending);
    const em = {
      findOne: jest.fn(async () => submission),
      create: jest.fn(),
      flush: jest.fn(),
      getReference: jest.fn(),
    };
    const service = new SubmissionsService(em as never, notifications as never, { enqueue: jest.fn() } as never, storageStub() as never);
    await expect(
      service.confirmFile(
        's1',
        { storageKey: 'k', fileName: 'x.pdf', replacesFileId: 'old' },
        client,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects replacement by non-owner', async () => {
    const old = file({ id: 'old', status: SubmissionStatus.Returned });
    const submission = submissionWithFiles([old], SubmissionStatus.Returned);
    submission.submittedBy = { id: 'other', email: 'o@x.com' };
    const em = {
      findOne: jest.fn(async () => submission),
      create: jest.fn(),
      flush: jest.fn(),
    };
    const service = new SubmissionsService(em as never, notifications as never, { enqueue: jest.fn() } as never, storageStub() as never);
    await expect(
      service.confirmFile(
        's1',
        { storageKey: 'k', fileName: 'x.pdf', replacesFileId: 'old' },
        client,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('completeMultipart rejects size mismatch after HEAD', async () => {
    const submission = submissionWithFiles([], SubmissionStatus.Draft);
    const em = {
      findOne: jest.fn(async () => submission),
      create: jest.fn(),
      flush: jest.fn(),
    };
    const storage = storageStub({
      completeMultipart: jest.fn(async () => undefined),
      head: jest.fn(async () => ({ sizeBytes: 10 })),
    });
    const service = new SubmissionsService(em as never, notifications as never, { enqueue: jest.fn() } as never, storage as never);

    await expect(
      service.completeMultipart(
        's1',
        'upload-1',
        {
          storageKey: 'abdcshare/submissions/s1/file.pdf',
          fileName: 'file.pdf',
          sizeBytes: 99,
          parts: [{ partNumber: 1, etag: '"abc"' }],
        },
        client,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('discardDraft rejects non-owner', async () => {
    const submission = submissionWithFiles([], SubmissionStatus.Draft);
    submission.submittedBy = { id: 'other-user', email: 'x@x.com' };
    const em = {
      findOne: jest.fn(async () => submission),
      removeAndFlush: jest.fn(),
    };
    const service = new SubmissionsService(em as never, notifications as never, { enqueue: jest.fn() } as never, storageStub() as never);
    await expect(service.discardDraft('s1', client)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('SubmissionsService.download / preview / zip-entries', () => {
  it('requestExport enqueues SubmissionExportRequested for current files', async () => {
    const f1 = file({
      id: 'f1',
      storageKey: 'k',
      fileName: 'a.pdf',
      status: SubmissionStatus.Pending,
    });
    const submission = submissionWithFiles([f1]);
    const outbox = { enqueue: jest.fn(() => ({ id: 'job-1' })) };
    const em = { findOne: jest.fn(async () => submission), flush: jest.fn() };
    const service = new SubmissionsService(
      em as never,
      notifications as never,
      outbox as never,
      storageStub() as never,
    );

    await expect(service.requestExport('s1', reviewer)).resolves.toEqual({
      accepted: true,
      jobId: 'job-1',
    });
    expect(outbox.enqueue).toHaveBeenCalledWith(
      'submission.export_requested',
      expect.objectContaining({ submissionId: 's1', actorUserId: reviewer.userId }),
    );
  });

  it('exportDownloadUrl rejects keys outside this submission prefix', async () => {
    const f1 = file({ id: 'f1', storageKey: 'k', fileName: 'a.pdf' });
    const submission = submissionWithFiles([f1]);
    const em = { findOne: jest.fn(async () => submission) };
    const service = new SubmissionsService(
      em as never,
      notifications as never,
      { enqueue: jest.fn() } as never,
      storageStub() as never,
    );
    await expect(
      service.exportDownloadUrl('s1', 'abdcshare/exports/other/file.zip', 'x.zip', reviewer),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('downloadUrl returns scoped presigned URL', async () => {
    const f1 = file({
      id: 'f1',
      storageKey: 'abdcshare/submissions/s1/a.pdf',
      fileName: 'a.pdf',
    });
    const submission = submissionWithFiles([f1]);
    const storage = storageStub({
      presignDownload: jest.fn(async () => 'https://r2.example/a.pdf'),
    });
    const em = { findOne: jest.fn(async () => submission) };
    const service = new SubmissionsService(
      em as never,
      notifications as never,
      { enqueue: jest.fn() } as never,
      storage as never,
    );

    await expect(service.downloadUrl('s1', 'f1', reviewer)).resolves.toEqual({
      url: 'https://r2.example/a.pdf',
    });
    expect(storage.presignDownload).toHaveBeenCalledWith(
      'abdcshare/submissions/s1/a.pdf',
      'a.pdf',
    );
  });

  it('previewUrl returns failed for Office when conversion failed', async () => {
    const f1 = file({
      id: 'f1',
      fileName: 'notes.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      storageKey: 'abdcshare/submissions/s1/notes.docx',
      previewStatus: 'Failed',
      previewError: 'soffice missing',
    });
    const submission = submissionWithFiles([f1]);
    const outbox = { enqueue: jest.fn() };
    const em = { findOne: jest.fn(async () => submission), flush: jest.fn() };
    const service = new SubmissionsService(
      em as never,
      notifications as never,
      outbox as never,
      storageStub({
        presignDownload: jest.fn(async () => 'https://r2.example/x'),
      }) as never,
    );

    await expect(
      service.previewUrl('s1', 'f1', reviewer, { retryFailed: true }),
    ).resolves.toMatchObject({
      reason: 'pending',
      previewStatus: 'Pending',
    });
    expect(outbox.enqueue).toHaveBeenCalled();

    // Polls without retryFailed must surface Failed, not re-enqueue forever.
    const fFailed = file({
      id: 'f1',
      fileName: 'notes.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      storageKey: 'abdcshare/submissions/s1/notes.docx',
      previewStatus: 'Failed',
    });
    em.findOne.mockResolvedValueOnce(submissionWithFiles([fFailed]));
    outbox.enqueue.mockClear();
    await expect(service.previewUrl('s1', 'f1', reviewer)).resolves.toMatchObject({
      reason: 'failed',
    });
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('previewUrl prefers converted PDF when Ready', async () => {
    const f1 = file({
      id: 'f1',
      fileName: 'notes.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      storageKey: 'abdcshare/submissions/s1/notes.docx',
      previewStatus: 'Ready',
      previewStorageKey: 'abdcshare/previews/notes.pdf',
    });
    const submission = submissionWithFiles([f1]);
    const storage = storageStub({
      presignDownload: jest.fn(async () => 'https://r2.example/preview.pdf'),
    });
    const em = { findOne: jest.fn(async () => submission) };
    const service = new SubmissionsService(
      em as never,
      notifications as never,
      { enqueue: jest.fn() } as never,
      storage as never,
    );

    await expect(service.previewUrl('s1', 'f1', reviewer)).resolves.toEqual({
      url: 'https://r2.example/preview.pdf',
      mode: 'converted',
      previewStatus: 'Ready',
    });
    expect(storage.presignDownload).toHaveBeenCalledWith(
      'abdcshare/previews/notes.pdf',
      'notes.docx.pdf',
      { disposition: 'inline' },
    );
  });

  it('zipEntries rejects non-zip files', async () => {
    const f1 = file({
      id: 'f1',
      fileName: 'a.pdf',
      mimeType: 'application/pdf',
      storageKey: 'k',
    });
    const submission = submissionWithFiles([f1]);
    const em = { findOne: jest.fn(async () => submission) };
    const service = new SubmissionsService(
      em as never,
      notifications as never,
      { enqueue: jest.fn() } as never,
      storageStub() as never,
    );
    await expect(service.zipEntries('s1', 'f1', reviewer)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
