import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { LibraryAdminService } from './library-admin.service';
import { LibraryItemEntity } from './infrastructure/persistence/library-item.entity';
import { UserEntity } from '../users/infrastructure/persistence/user.entity';
import type { LibraryViewer } from './library-access';

const staff: LibraryViewer = { userId: 'u-staff', departmentId: 2, isCurator: false };
const curator: LibraryViewer = { userId: 'u-sa', departmentId: null, isCurator: true };

function setup(opts: { user?: Record<string, unknown> | null; item?: Record<string, unknown> | null } = {}) {
  const execute = jest.fn(async (..._a: unknown[]) => [] as unknown[]);
  const em = {
    execute,
    findOne: jest.fn(async (entity: unknown) => {
      if (entity === UserEntity) return opts.user === undefined ? null : opts.user;
      if (entity === LibraryItemEntity) return opts.item ?? null;
      return null;
    }),
    flush: jest.fn(async () => undefined),
  };
  const events = { stage: jest.fn((..._a: unknown[]) => undefined as unknown) };
  return { service: new LibraryAdminService(em as never, events as never), em, events, execute };
}

describe('LibraryAdminService', () => {
  it('duplicate lookup applies the viewer scope and only returns Published items', async () => {
    const { service, execute } = setup();
    await service.duplicatesOf('A'.repeat(64), staff);
    const [sql, params] = execute.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("i.status = 'Published'");
    expect(sql).toContain('i.uploaded_by_id = ?'); // library scope for a non-curator
    expect(params[0]).toBe('a'.repeat(64)); // normalised
    await expect(service.duplicatesOf('nothex', staff)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('only curators transfer, see attention, duplicates or department impact', async () => {
    const { service } = setup();
    await expect(service.transferItem('i', 'u', staff)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.transferAll('a', 'b', staff)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.attention(staff)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.duplicateGroups(staff)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.departmentImpact(1, staff)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses inactive users and roles that cannot contribute as new owners', async () => {
    const item = { id: 'i', uploadedBy: { id: 'old', fullName: 'Old' } };
    const inactive = setup({ item, user: { id: 'u', fullName: 'U', isActive: false, role: { roleName: 'Staff' } } });
    await expect(inactive.service.transferItem('i', 'u', curator)).rejects.toThrow('active user');
    const client = setup({ item, user: { id: 'u', fullName: 'U', isActive: true, role: { roleName: 'Client' } } });
    await expect(client.service.transferItem('i', 'u', curator)).rejects.toThrow('cannot own library items');
  });

  it('transfers an item and logs OwnershipTransferred with from/to', async () => {
    const item = { id: 'i', uploadedBy: { id: 'old', fullName: 'Old Owner' } };
    const { service, events, em } = setup({ item, user: { id: 'new', fullName: 'New Owner', isActive: true, role: { roleName: 'Staff' } } });
    await expect(service.transferItem('i', 'new', curator)).resolves.toEqual({ items: 1, collections: 0 });
    expect(item.uploadedBy).toMatchObject({ id: 'new' });
    expect(events.stage).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'OwnershipTransferred',
        itemId: 'i',
        metadata: { from: { id: 'old', name: 'Old Owner' }, to: { id: 'new', name: 'New Owner' } },
      }),
    );
    expect(em.flush).toHaveBeenCalled();
  });
});
