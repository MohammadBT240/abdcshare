import { BadRequestException } from '@nestjs/common';
import { SubmissionStatus } from '@abdcshare/shared';
import { SubmissionsService } from './submissions.service';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';

const reviewer = {
  userId: 'reviewer-1',
  email: '',
  role: 'Super Admin',
  mustChangePassword: false,
} as AuthenticatedUser;

const notifications = { emit: jest.fn(async () => undefined) };

describe('SubmissionsService.review', () => {
  it('accepts a pending submission and stamps the reviewer', async () => {
    const submission: Record<string, unknown> = {
      status: SubmissionStatus.Pending,
      submittedBy: { id: 'client-1', email: 'c@x.com' },
      request: { id: 'r1' },
    };
    const em = {
      findOne: jest.fn(async () => submission),
      getReference: jest.fn((_e: unknown, id: unknown) => ({ id })),
      flush: jest.fn(async () => undefined),
    };
    const service = new SubmissionsService(em as never, notifications as never);
    jest.spyOn(service, 'getOne').mockResolvedValue({ id: 's1' } as never);

    await service.review('s1', { decision: SubmissionStatus.Accepted, reason: 'looks good' }, reviewer);

    expect(submission.status).toBe(SubmissionStatus.Accepted);
    expect(submission.reviewReason).toBe('looks good');
    expect(submission.reviewedAt).toBeInstanceOf(Date);
    expect(submission.reviewedBy).toEqual({ id: 'reviewer-1' });
    expect(notifications.emit).toHaveBeenCalled(); // client notified of the decision
  });

  it('rejects reviewing a submission that is not pending', async () => {
    const em = {
      findOne: jest.fn(async () => ({ status: SubmissionStatus.Accepted })),
      getReference: jest.fn(),
      flush: jest.fn(),
    };
    const service = new SubmissionsService(em as never, notifications as never);
    await expect(
      service.review('s1', { decision: SubmissionStatus.Returned }, reviewer),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
