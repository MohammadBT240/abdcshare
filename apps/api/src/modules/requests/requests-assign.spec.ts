import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { RequestsService } from "./requests.service";
import { RequestEntity } from "./infrastructure/persistence/request.entity";
import { RequestAssigneeEntity } from "./infrastructure/persistence/request-assignee.entity";
import { EngagementTeamMemberEntity } from "../engagements/infrastructure/persistence/engagement-team-member.entity";
import { UserEntity } from "../users/infrastructure/persistence/user.entity";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user";

const staff = { userId: "s1", email: "", role: "Staff", mustChangePassword: false } as AuthenticatedUser;
const amina = { id: "u-amina", fullName: "Amina Bello", email: "amina@x.co", isActive: true };
const outsider = { id: "u-out", fullName: "Olu Outsider", email: "olu@x.co", isActive: true };

function build(team: string[]) {
  const request = { id: "r1", description: "Bank statements", engagement: { id: "eng-1" } };
  const em = {
    findOne: jest.fn(async (entity: unknown) => (entity === RequestEntity ? request : null)),
    find: jest.fn(async (entity: unknown, where: { id?: { $in: string[] }; user?: { $in: string[] } }) => {
      if (entity === UserEntity) return [amina, outsider].filter((u) => where.id!.$in.includes(u.id));
      if (entity === EngagementTeamMemberEntity)
        return team.filter((id) => where.user!.$in.includes(id)).map((id) => ({ engagement: { id: "eng-1" }, user: { id } }));
      return [];
    }),
    create: jest.fn(),
    getReference: jest.fn((_: unknown, id: string) => ({ id })),
    flush: jest.fn(),
  };
  const service = new RequestsService(em as never, { emit: jest.fn() } as never, { enqueue: jest.fn() } as never, {} as never);
  jest.spyOn(service, "getOne").mockResolvedValue({} as never);
  return { service, em };
}

describe("RequestsService.assign", () => {
  it("assigns someone on the engagement team (Staff can, S10)", async () => {
    const { service, em } = build([amina.id]);
    await service.assign("r1", { userId: amina.id }, staff);
    expect(em.create).toHaveBeenCalledWith(RequestAssigneeEntity, expect.objectContaining({ user: amina }));
  });

  it("refuses someone who isn't on the engagement team", async () => {
    const { service, em } = build([amina.id]);
    await expect(service.assign("r1", { userId: outsider.id }, staff)).rejects.toBeInstanceOf(BadRequestException);
    expect(em.create).not.toHaveBeenCalled();
  });
});

describe("RequestsService.bulkUpdate permissions", () => {
  it("needs request:assign to bulk-assign", async () => {
    const { service } = build([amina.id]);
    const client = { userId: "c1", email: "", role: "Client", clientId: "cl-1", mustChangePassword: false } as AuthenticatedUser;
    await expect(service.bulkUpdate({ ids: ["r1"], assigneeUserId: amina.id }, client)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
