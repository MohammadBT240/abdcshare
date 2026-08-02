import { ForbiddenException } from "@nestjs/common";
import {
  DocumentCategory,
  DocumentStatus,
  EngagementPhase,
  EngagementStatus,
  EVENT,
} from "@abdcshare/shared";
import { DocumentsService } from "./documents.service";
import { DocumentEntity } from "./infrastructure/persistence/document.entity";
import { DocumentFileEntity } from "./infrastructure/persistence/document-file.entity";
import { EngagementSignOffEntity } from "../engagements/infrastructure/persistence/engagement-sign-off.entity";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user";

const staff = {
  userId: "s1",
  email: "",
  role: "Staff",
  mustChangePassword: false,
} as AuthenticatedUser;
const superAdmin = {
  userId: "sa1",
  email: "",
  role: "Super Admin",
  mustChangePassword: false,
} as AuthenticatedUser;

function mockNotifications() {
  return { emit: jest.fn(async () => undefined) };
}

describe("DocumentsService", () => {
  describe("create — final-report gate", () => {
    it("forbids a Staff member from creating a FinalReport", async () => {
      const em = {
        findOne: jest.fn(),
        create: jest.fn(),
        persistAndFlush: jest.fn(),
        getReference: jest.fn(),
      };
      const outbox = { enqueue: jest.fn() };
      const storage = { presignUpload: jest.fn(), presignDownload: jest.fn() };
      const service = new DocumentsService(
        em as never,
        outbox as never,
        mockNotifications() as never,
        storage as never,
      );

      await expect(
        service.create(
          {
            engagementId: "e1",
            requestClassId: 1,
            category: DocumentCategory.FinalReport,
            title: "FS",
          },
          staff,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(em.findOne).not.toHaveBeenCalled(); // rejected before any load
    });

    it("forbids Staff from creating Supporting (requires engagement:update)", async () => {
      const em = {
        findOne: jest.fn(),
        create: jest.fn(),
        persistAndFlush: jest.fn(),
        getReference: jest.fn(),
      };
      const service = new DocumentsService(
        em as never,
        { enqueue: jest.fn() } as never,
        mockNotifications() as never,
        { presignUpload: jest.fn(), presignDownload: jest.fn() } as never,
      );

      await expect(
        service.create(
          {
            engagementId: "e1",
            category: DocumentCategory.Supporting,
            title: "Letter",
          },
          staff,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(em.findOne).not.toHaveBeenCalled();
    });

    it("creates a Supporting document with no request class, phase defaulting to the engagement stage", async () => {
      const created: Array<{ entity: unknown; data: Record<string, unknown> }> =
        [];
      const em = {
        findOne: jest.fn(async () => ({
          id: "e1",
          department: { id: 1 },
          stage: EngagementStatus.Planning,
        })),
        create: jest.fn((entity: unknown, data: Record<string, unknown>) => {
          const row = { id: "doc-1", ...data };
          created.push({ entity, data: row });
          return row;
        }),
        getReference: jest.fn((_e: unknown, id: unknown) => ({ id })),
        persistAndFlush: jest.fn(async () => undefined),
      };
      const service = new DocumentsService(
        em as never,
        { enqueue: jest.fn() } as never,
        mockNotifications() as never,
        { presignUpload: jest.fn(), presignDownload: jest.fn() } as never,
      );
      jest.spyOn(service, "getOne").mockResolvedValue({ id: "doc-1" } as never);

      await service.create(
        {
          engagementId: "e1",
          category: DocumentCategory.Supporting,
          title: "Prior-year file",
        },
        superAdmin,
      );

      const doc = created.find((c) => c.entity === DocumentEntity)?.data;
      expect(doc?.requestClass).toBeNull(); // engagement-level, no request class
      expect(doc?.phase).toBe(EngagementPhase.Planning); // defaulted from engagement stage
    });

    it("creates a FinalReport without a request class", async () => {
      const created: Array<{ entity: unknown; data: Record<string, unknown> }> =
        [];
      const em = {
        findOne: jest.fn(async () => ({
          id: "e1",
          department: { id: 1 },
          stage: EngagementStatus.Reporting,
        })),
        count: jest.fn(async () => 0),
        create: jest.fn((entity: unknown, data: Record<string, unknown>) => {
          const row = { id: "fr-1", ...data };
          created.push({ entity, data: row });
          return row;
        }),
        getReference: jest.fn((_e: unknown, id: unknown) => ({ id })),
        persistAndFlush: jest.fn(async () => undefined),
      };
      const service = new DocumentsService(
        em as never,
        { enqueue: jest.fn() } as never,
        mockNotifications() as never,
        { presignUpload: jest.fn(), presignDownload: jest.fn() } as never,
      );
      jest.spyOn(service, "getOne").mockResolvedValue({ id: "fr-1" } as never);

      await service.create(
        {
          engagementId: "e1",
          requestClassId: 99, // ignored for final reports
          category: DocumentCategory.FinalReport,
          title: "Statutory accounts",
        },
        superAdmin,
      );

      const doc = created.find((c) => c.entity === DocumentEntity)?.data;
      expect(doc?.requestClass).toBeNull();
      expect(doc?.request).toBeNull();
      expect(doc?.category).toBe(DocumentCategory.FinalReport);
    });

    it("creates a WorkingPaper without a request class", async () => {
      const created: Array<{ entity: unknown; data: Record<string, unknown> }> =
        [];
      const em = {
        findOne: jest.fn(async () => ({
          id: "e1",
          department: { id: 1 },
          stage: EngagementStatus.Execution,
        })),
        count: jest.fn(async () => 0),
        create: jest.fn((entity: unknown, data: Record<string, unknown>) => {
          const row = { id: "wp-1", ...data };
          created.push({ entity, data: row });
          return row;
        }),
        getReference: jest.fn((_e: unknown, id: unknown) => ({ id })),
        persistAndFlush: jest.fn(async () => undefined),
      };
      const service = new DocumentsService(
        em as never,
        { enqueue: jest.fn() } as never,
        mockNotifications() as never,
        { presignUpload: jest.fn(), presignDownload: jest.fn() } as never,
      );
      jest.spyOn(service, "getOne").mockResolvedValue({ id: "wp-1" } as never);

      await service.create(
        {
          engagementId: "e1",
          category: DocumentCategory.WorkingPaper,
          title: "Bank rec pack",
        },
        staff,
      );

      const doc = created.find((c) => c.entity === DocumentEntity)?.data;
      expect(doc?.requestClass).toBeNull();
      expect(doc?.category).toBe(DocumentCategory.WorkingPaper);
    });
  });

  describe("confirmUpload", () => {
    it("creates the next version, bumps the document, and emits an event (Super Admin)", async () => {
      const doc = {
        id: "d1",
        title: "WP",
        currentVersion: 2,
        status: DocumentStatus.Draft,
        category: DocumentCategory.WorkingPaper,
        engagement: { id: "e1" },
        requestClass: { id: 4 },
      };
      const created: Array<{ entity: unknown; data: Record<string, unknown> }> =
        [];
      const em = {
        findOne: jest.fn(async () => doc), // findScoped load
        count: jest.fn(async () => 0),
        find: jest.fn(async () => []),
        create: jest.fn((entity: unknown, data: Record<string, unknown>) => {
          const row = { id: "file-1", ...data };
          created.push({ entity, data: row });
          return row;
        }),
        getReference: jest.fn((_e: unknown, id: unknown) => ({ id })),
        persistAndFlush: jest.fn(async () => undefined),
      };
      const outbox = { enqueue: jest.fn() };
      const notifications = mockNotifications();
      const storage = { presignUpload: jest.fn(), presignDownload: jest.fn() };
      const service = new DocumentsService(
        em as never,
        outbox as never,
        notifications as never,
        storage as never,
      );
      jest.spyOn(service, "getOne").mockResolvedValue({ id: "d1" } as never);

      await service.confirmUpload(
        "d1",
        {
          storageKey: "documents/e1/abc-fs.pdf",
          fileName: "fs.pdf",
          sizeBytes: 1024,
        },
        superAdmin,
      );

      const file = created.find((c) => c.entity === DocumentFileEntity)?.data;
      expect(file?.version).toBe(3); // 2 → 3
      expect(doc.currentVersion).toBe(3);
      expect(doc.status).toBe(DocumentStatus.Ready); // Draft → Ready on first content
      expect(outbox.enqueue).toHaveBeenCalledWith(
        EVENT.DocumentFileUploaded,
        expect.objectContaining({ documentId: "d1", version: 3 }),
      );
      expect(notifications.emit).toHaveBeenCalled();
    });

    it("allows a working-paper upload even after its class is signed off", async () => {
      const doc = {
        id: "d1",
        title: "WP",
        currentVersion: 1,
        status: DocumentStatus.Ready,
        category: DocumentCategory.WorkingPaper,
        engagement: { id: "e1" },
        requestClass: { id: 4 },
      };
      const created: Array<{ entity: unknown; data: Record<string, unknown> }> =
        [];
      const em = {
        findOne: jest.fn(async () => doc),
        count: jest.fn(async (entity: unknown) =>
          entity === EngagementSignOffEntity ? 1 : 0,
        ),
        find: jest.fn(async () => []),
        create: jest.fn((entity: unknown, data: Record<string, unknown>) => {
          const row = { id: "file-1", ...data };
          created.push({ entity, data: row });
          return row;
        }),
        getReference: jest.fn((_e: unknown, id: unknown) => ({ id })),
        persistAndFlush: jest.fn(async () => undefined),
      };
      const service = new DocumentsService(
        em as never,
        { enqueue: jest.fn() } as never,
        mockNotifications() as never,
        { presignUpload: jest.fn(), presignDownload: jest.fn() } as never,
      );
      jest.spyOn(service, "getOne").mockResolvedValue({ id: "d1" } as never);

      await service.confirmUpload(
        "d1",
        { storageKey: "documents/e1/wp.pdf", fileName: "wp.pdf" },
        staff,
      );
      expect(created.some((c) => c.entity === DocumentFileEntity)).toBe(true);
      expect(doc.currentVersion).toBe(2);
    });
  });
});
