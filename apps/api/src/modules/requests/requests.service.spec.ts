import {
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { RequestsService } from "./requests.service";
import { RequestEntity } from "./infrastructure/persistence/request.entity";
import { RequestStageEntity } from "../request-stages/infrastructure/persistence/request-stage.entity";
import { RequestStatusEntity } from "../request-statuses/infrastructure/persistence/request-status.entity";
import { RequestAssigneeEntity } from "./infrastructure/persistence/request-assignee.entity";
import { ClientSubmissionEntity } from "../submissions/infrastructure/persistence/client-submission.entity";
import { DocumentEntity } from "../documents/infrastructure/persistence/document.entity";
import { EngagementEntity } from "../engagements/infrastructure/persistence/engagement.entity";
import { EngagementRequestClassEntity } from "../engagements/infrastructure/persistence/engagement-request-class.entity";
import { EngagementSignOffEntity } from "../engagements/infrastructure/persistence/engagement-sign-off.entity";
import { EngagementTeamMemberEntity } from "../engagements/infrastructure/persistence/engagement-team-member.entity";
import { RequestTypeEntity } from "../request-types/infrastructure/persistence/request-type.entity";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user";

// Super Admin ⇒ unscoped (resolveScope → 'all'), so no membership check runs.
const admin = {
  userId: "u1",
  email: "",
  role: "Super Admin",
  mustChangePassword: false,
} as AuthenticatedUser;

describe("RequestsService", () => {
  describe("create — request-class scope rule", () => {
    it("rejects a request whose type request class is not in the engagement scope", async () => {
      const em = {
        findOne: jest.fn(async (entity: unknown) => {
          if (entity === EngagementEntity) return { id: "eng-1" };
          if (entity === RequestTypeEntity)
            return {
              id: 7,
              name: "Bank stmt",
              requestClass: { id: 5, name: "Cash" },
            };
          if (entity === EngagementRequestClassEntity) return null; // NOT in scope
          return null;
        }),
        create: jest.fn(),
        count: jest.fn(),
        getReference: jest.fn(),
        persistAndFlush: jest.fn(),
        find: jest.fn(async () => []),
      };
      const service = new RequestsService(
        em as never,
        { emit: jest.fn() } as never,
        { enqueue: jest.fn() } as never,
        {
          presignUpload: jest.fn(),
          presignDownload: jest.fn(),
          head: jest.fn(),
        } as never,
      );
      await expect(
        service.create(
          {
            engagementId: "eng-1",
            requestTypeId: 7,
            description: "Provide it",
          },
          admin,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(em.create).not.toHaveBeenCalled(); // failed before persisting
    });

    it("allows creating a request even after its class is signed off", async () => {
      const created: Array<{ entity: unknown; data: Record<string, unknown> }> =
        [];
      const em = {
        findOne: jest.fn(async (entity: unknown) => {
          if (entity === EngagementEntity)
            return { id: "eng-1", stage: "Planning" };
          if (entity === EngagementTeamMemberEntity) return { id: "tm-1" };
          if (entity === RequestTypeEntity)
            return {
              id: 7,
              name: "Bank stmt",
              requestClass: { id: 5, name: "Cash" },
            };
          if (entity === EngagementRequestClassEntity) return { id: "scope-1" };
          if (entity === RequestStageEntity)
            return { id: 1, name: "Not Started" };
          if (entity === RequestStatusEntity) return { id: 1, name: "Open" };
          return null;
        }),
        count: jest.fn(async (entity: unknown) =>
          entity === EngagementSignOffEntity ? 1 : 0,
        ),
        create: jest.fn((entity: unknown, data: Record<string, unknown>) => {
          const row = { id: "r-new", ...data };
          created.push({ entity, data: row });
          return row;
        }),
        getReference: jest.fn((_e: unknown, id: unknown) => ({ id })),
        persistAndFlush: jest.fn(async () => undefined),
        find: jest.fn(async (entity: unknown) => {
          if (entity === RequestStatusEntity) return [{ id: 1, name: "Open" }];
          if (entity === RequestStageEntity)
            return [{ id: 1, name: "Not Started" }];
          return [];
        }),
      };
      const service = new RequestsService(
        em as never,
        { emit: jest.fn() } as never,
        { enqueue: jest.fn() } as never,
        {
          presignUpload: jest.fn(),
          presignDownload: jest.fn(),
          head: jest.fn(),
        } as never,
      );
      jest.spyOn(service, "getOne").mockResolvedValue({ id: "r-new" } as never);

      const staff = {
        userId: "s1",
        email: "",
        role: "Staff",
        mustChangePassword: false,
      } as AuthenticatedUser;

      await service.create({ engagementId: "eng-1", requestTypeId: 7 }, staff);
      expect(created.some((c) => c.entity === RequestEntity)).toBe(true);
    });
  });

  describe("setStage", () => {
    it("rejects manual stage changes", async () => {
      const service = new RequestsService(
        {} as never,
        { emit: jest.fn() } as never,
        { enqueue: jest.fn() } as never,
        {
          presignUpload: jest.fn(),
          presignDownload: jest.fn(),
          head: jest.fn(),
        } as never,
      );

      await expect(
        service.setStage("r1", { stageId: 2, note: "moving on" }, admin),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe("remove", () => {
    it("blocks deletion when submissions or documents exist", async () => {
      const request = { id: "r1" };
      const em = {
        findOne: jest.fn(async (entity: unknown) =>
          entity === RequestEntity ? request : null,
        ),
        count: jest.fn(async (entity: unknown) =>
          entity === ClientSubmissionEntity ? 1 : 0,
        ),
        removeAndFlush: jest.fn(),
      };
      const service = new RequestsService(
        em as never,
        { emit: jest.fn() } as never,
        { enqueue: jest.fn() } as never,
        {
          presignUpload: jest.fn(),
          presignDownload: jest.fn(),
          head: jest.fn(),
        } as never,
      );

      await expect(service.remove("r1", admin)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(em.count).toHaveBeenCalledWith(DocumentEntity, { request: "r1" });
      expect(em.removeAndFlush).not.toHaveBeenCalled();
    });

    it("hard deletes an empty request", async () => {
      const request = { id: "r1" };
      const em = {
        findOne: jest.fn(async () => request),
        count: jest.fn(async () => 0),
        removeAndFlush: jest.fn(async () => undefined),
      };
      const service = new RequestsService(
        em as never,
        { emit: jest.fn() } as never,
        { enqueue: jest.fn() } as never,
        {
          presignUpload: jest.fn(),
          presignDownload: jest.fn(),
          head: jest.fn(),
        } as never,
      );

      await expect(service.remove("r1", admin)).resolves.toEqual({ ok: true });
      expect(em.removeAndFlush).toHaveBeenCalledWith(request);
    });
  });

  describe("bulkUpdate", () => {
    it("updates stage, status and assignee for all scoped requests", async () => {
      const requests = [
        {
          id: "r1",
          stage: { name: "Open" },
          status: { name: "New" },
          engagement: { id: "e1" },
          requestType: { requestClass: { id: 1 } },
        },
        {
          id: "r2",
          stage: { name: "Open" },
          status: { name: "New" },
          engagement: { id: "e1" },
          requestType: { requestClass: { id: 1 } },
        },
      ];
      const status = { id: 3, name: "Active" };
      const assignee = { id: "u2", fullName: "User Two", email: null };
      const em = {
        find: jest.fn(async (entity: unknown) =>
          entity === RequestEntity ? requests : [],
        ),
        findOne: jest.fn(async (entity: unknown) => {
          if (entity === RequestStatusEntity) return status;
          if (entity === RequestEntity) return requests[0];
          if (entity === RequestStageEntity)
            return { id: 1, name: "Not Started" };
          return assignee;
        }),
        nativeDelete: jest.fn(async () => 0),
        create: jest.fn((_entity: unknown, data: unknown) => data),
        getReference: jest.fn((_entity: unknown, id: string) => ({ id })),
        flush: jest.fn(async () => undefined),
        count: jest.fn(async () => 0),
      };
      const service = new RequestsService(
        em as never,
        { emit: jest.fn() } as never,
        { enqueue: jest.fn() } as never,
        {
          presignUpload: jest.fn(),
          presignDownload: jest.fn(),
          head: jest.fn(),
        } as never,
      );

      await expect(
        service.bulkUpdate(
          {
            ids: ["r1", "r2"],
            statusId: 3,
            assigneeUserId: "u2",
          },
          admin,
        ),
      ).resolves.toEqual({ updated: 2 });
      expect(requests.every((r) => r.status === status)).toBe(true);
      expect(em.create).toHaveBeenCalledWith(
        RequestAssigneeEntity,
        expect.objectContaining({ user: assignee }),
      );
    });
  });
});
