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
