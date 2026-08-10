import { BadRequestException } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';

const staff = { userId: 's1', email: '', role: 'Staff', mustChangePassword: false } as AuthenticatedUser;

describe('ReviewsService.submit — target validation', () => {
  const service = new ReviewsService({} as never, { emit: jest.fn() } as never);

  it('rejects when neither requestId nor documentId is given', async () => {
    await expect(service.submit({}, staff)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when both requestId and documentId are given', async () => {
    await expect(
      service.submit({ requestId: 'r1', documentId: 'd1' }, staff),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('ReviewsService.list — decision queue', () => {
  it('allows an unscoped pending queue for reviewers', async () => {
    const em = {
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    const service = new ReviewsService(em as never, { emit: jest.fn() } as never);
    const reviewer = {
      userId: 'reviewer-1',
      email: '',
      role: 'Super Admin',
      mustChangePassword: false,
    } as AuthenticatedUser;

    await expect(
      service.list({ status: 'ForReview' as never, page: 1, pageSize: 20 }, reviewer),
    ).resolves.toMatchObject({ data: [], meta: { total: 0 } });
    expect(em.findAndCount).toHaveBeenCalledWith(
      expect.anything(),
      { reviewer: reviewer.userId, status: 'ForReview' },
      expect.any(Object),
    );
  });
});
