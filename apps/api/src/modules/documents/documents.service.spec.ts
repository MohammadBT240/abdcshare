import { ForbiddenException } from '@nestjs/common';
import { DocumentCategory, DocumentStatus, EngagementPhase, EngagementStatus, EVENT } from '@abdcshare/shared';
import { DocumentsService } from './documents.service';
import { DocumentEntity } from './infrastructure/persistence/document.entity';
import { DocumentFileEntity } from './infrastructure/persistence/document-file.entity';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';

const staff = { userId: 's1', email: '', role: 'Staff', mustChangePassword: false } as AuthenticatedUser;
const superAdmin = {
  userId: 'sa1',
  email: '',
  role: 'Super Admin',
  mustChangePassword: false,
} as AuthenticatedUser;

describe('DocumentsService', () => {
  describe('create — final-report gate', () => {
    it('forbids a Staff member from creating a FinalReport', async () => {
      const em = { findOne: jest.fn(), create: jest.fn(), persistAndFlush: jest.fn(), getReference: jest.fn() };
      const outbox = { enqueue: jest.fn() };
      const storage = { presignUpload: jest.fn(), presignDownload: jest.fn() };
      const service = new DocumentsService(em as never, outbox as never, storage as never);

      await expect(
        service.create(
          { engagementId: 'e1', requestClassId: 1, category: DocumentCategory.FinalReport, title: 'FS' },
          staff,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(em.findOne).not.toHaveBeenCalled(); // rejected before any load
    });

    it('creates a Supporting document with no request class, phase defaulting to the engagement stage', async () => {
      const created: Array<{ entity: unknown; data: Record<string, unknown> }> = [];
      const em = {
        findOne: jest.fn(async () => ({ id: 'e1', department: { id: 1 }, status: EngagementStatus.Planning })),
        create: jest.fn((entity: unknown, data: Record<string, unknown>) => {
          const row = { id: 'doc-1', ...data };
          created.push({ entity, data: row });
          return row;
        }),
        getReference: jest.fn((_e: unknown, id: unknown) => ({ id })),
        persistAndFlush: jest.fn(async () => undefined),
      };
      const service = new DocumentsService(
        em as never,
        { enqueue: jest.fn() } as never,
        { presignUpload: jest.fn(), presignDownload: jest.fn() } as never,
      );
      jest.spyOn(service, 'getOne').mockResolvedValue({ id: 'doc-1' } as never);

      await service.create(
        { engagementId: 'e1', category: DocumentCategory.Supporting, title: 'Prior-year file' },
        superAdmin,
      );

      const doc = created.find((c) => c.entity === DocumentEntity)?.data;
      expect(doc?.requestClass).toBeNull(); // engagement-level, no request class
      expect(doc?.phase).toBe(EngagementPhase.Planning); // defaulted from engagement stage
    });
  });

  describe('confirmUpload', () => {
    it('creates the next version, bumps the document, and emits an event (Super Admin)', async () => {
      const doc = { id: 'd1', currentVersion: 2, status: DocumentStatus.Draft };
      const created: Array<{ entity: unknown; data: Record<string, unknown> }> = [];
      const em = {
        findOne: jest.fn(async () => doc), // findScoped load
        create: jest.fn((entity: unknown, data: Record<string, unknown>) => {
          const row = { id: 'file-1', ...data };
          created.push({ entity, data: row });
          return row;
        }),
        getReference: jest.fn((_e: unknown, id: unknown) => ({ id })),
        persistAndFlush: jest.fn(async () => undefined),
      };
      const outbox = { enqueue: jest.fn() };
      const storage = { presignUpload: jest.fn(), presignDownload: jest.fn() };
      const service = new DocumentsService(em as never, outbox as never, storage as never);
      jest.spyOn(service, 'getOne').mockResolvedValue({ id: 'd1' } as never);

      await service.confirmUpload(
        'd1',
        { storageKey: 'documents/e1/abc-fs.pdf', fileName: 'fs.pdf', sizeBytes: 1024 },
        superAdmin,
      );

      const file = created.find((c) => c.entity === DocumentFileEntity)?.data;
      expect(file?.version).toBe(3); // 2 → 3
      expect(doc.currentVersion).toBe(3);
      expect(doc.status).toBe(DocumentStatus.Ready); // Draft → Ready on first content
      expect(outbox.enqueue).toHaveBeenCalledWith(
        EVENT.DocumentFileUploaded,
        expect.objectContaining({ documentId: 'd1', version: 3 }),
      );
    });
  });
});
