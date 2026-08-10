import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EngagementMemberRole, EngagementStage } from '@abdcshare/shared';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { EngagementsService } from './engagements.service';
import { EngagementEntity } from './infrastructure/persistence/engagement.entity';
import { EngagementTeamMemberEntity } from './infrastructure/persistence/engagement-team-member.entity';

const sa = {
  userId: 'sa-1',
  email: 'sa@example.com',
  role: 'Super Admin',
  mustChangePassword: false,
} as AuthenticatedUser;

const staffLead = {
  userId: 'lead-1',
  email: 'lead@example.com',
  role: 'Staff',
  mustChangePassword: false,
} as AuthenticatedUser;

const staffMember = {
  userId: 'member-1',
  email: 'member@example.com',
  role: 'Staff',
  mustChangePassword: false,
} as AuthenticatedUser;

function mockOutbox() {
  return { enqueue: jest.fn() };
}

function mockNotifications() {
  return { emit: jest.fn(async () => undefined) };
}

describe('Engagement Lead capabilities', () => {
  describe('create / clone auto-Lead', () => {
    it('adds the creator as Lead on create', async () => {
      const created: Array<{ entity: unknown; data: Record<string, unknown> }> = [];
      const { UserEntity } = await import('../users/infrastructure/persistence/user.entity');
      const em = {
        findOne: jest.fn(async () => ({ id: 1, name: 'X', primaryContact: { id: 'contact-1' } })),
        count: jest.fn(async () => 0),
        getReference: jest.fn((_e: unknown, id: unknown) => ({ id })),
        create: jest.fn((entity: unknown, data: Record<string, unknown>) => {
          const row = { id: 'eng-1', ...data };
          created.push({ entity, data: row });
          return row;
        }),
        persistAndFlush: jest.fn(async () => undefined),
        find: jest.fn(async (entity: unknown) => {
          if (entity === UserEntity) {
            return [{ id: 'contact-1', role: { roleName: 'Client' }, isActive: true }];
          }
          return [];
        }),
        flush: jest.fn(async () => undefined),
      };
      const service = new EngagementsService(
        em as never,
        mockOutbox() as never,
        mockNotifications() as never,
        { presignDownload: jest.fn() } as never,
      );
      jest.spyOn(service, 'getOne').mockResolvedValue({ id: 'eng-1' } as never);

      await service.create(
        {
          clientId: 'c1',
          engagementTypeId: 1,
          departmentId: 1,
          title: 'FY25',
          clientContactUserIds: ['contact-1'],
          mainClientContactUserId: 'contact-1',
        },
        sa.userId,
      );

      const lead = created.find((c) => c.entity === EngagementTeamMemberEntity)?.data;
      expect(lead?.memberRole).toBe(EngagementMemberRole.Lead);
      expect(lead?.user).toEqual({ id: sa.userId });
    });
  });

  describe('elevate / remove sole Lead', () => {
    it('elevates a Member and demotes the previous Lead', async () => {
      const engagement = { id: 'e1', referenceCode: 'ENG-1' };
      const leadRow = {
        user: { id: 'lead-1', fullName: 'Lead', email: 'l@x.com' },
        memberRole: EngagementMemberRole.Lead,
      };
      const memberRow = {
        user: { id: 'member-1', fullName: 'Member', email: 'm@x.com' },
        memberRole: EngagementMemberRole.Member,
      };
      const em = {
        findOneOrFail: jest.fn(async () => engagement),
        findOne: jest.fn(async (entity: unknown, where: Record<string, unknown>) => {
          if (entity === EngagementTeamMemberEntity && where.user === 'lead-1') {
            return { ...leadRow, memberRole: EngagementMemberRole.Lead };
          }
          // capability check for SA — hasPermission short-circuits before findOne for lead
          if (entity === EngagementTeamMemberEntity && where.memberRole === EngagementMemberRole.Lead) {
            return leadRow;
          }
          if (entity === EngagementEntity) return engagement;
          // target user for elevate
          if (where.id === 'member-1') {
            return { id: 'member-1', fullName: 'Member', email: 'm@x.com' };
          }
          if (entity === EngagementTeamMemberEntity && where.user === 'member-1') {
            return memberRow;
          }
          return null;
        }),
        find: jest.fn(async () => [leadRow, memberRow]),
        create: jest.fn(),
        flush: jest.fn(async () => undefined),
        getReference: jest.fn((_e: unknown, id: unknown) => ({ id })),
      };
      const service = new EngagementsService(
        em as never,
        mockOutbox() as never,
        mockNotifications() as never,
        { presignDownload: jest.fn() } as never,
      );
      jest.spyOn(service, 'getOne').mockResolvedValue({ id: 'e1' } as never);

      await service.elevateTeamMember('e1', 'member-1', sa);
      expect(memberRow.memberRole).toBe(EngagementMemberRole.Lead);
      expect(leadRow.memberRole).toBe(EngagementMemberRole.Member);
    });

    it('rejects removing the sole Lead', async () => {
      const existing = {
        user: { id: 'lead-1', fullName: 'Lead', email: 'l@x.com' },
        engagement: { referenceCode: 'ENG-1' },
        memberRole: EngagementMemberRole.Lead,
      };
      const em = {
        findOne: jest.fn(async () => existing),
        count: jest.fn(async () => 1),
        removeAndFlush: jest.fn(),
      };
      const service = new EngagementsService(
        em as never,
        mockOutbox() as never,
        mockNotifications() as never,
        { presignDownload: jest.fn() } as never,
      );

      await expect(
        service.removeTeamMember('e1', 'lead-1', sa),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(em.removeAndFlush).not.toHaveBeenCalled();
    });
  });

  describe('scoped permissions', () => {
    it('allows a Staff Lead to update their engagement', async () => {
      const engagement = {
        id: 'e1',
        title: 'Old',
        periodLabel: null,
        startDate: null,
        targetCompletionDate: null,
      };
      const em = {
        findOne: jest.fn(async (entity: unknown) => {
          if (entity === EngagementTeamMemberEntity) {
            return { memberRole: EngagementMemberRole.Lead };
          }
          return null;
        }),
        findOneOrFail: jest.fn(async () => engagement),
        flush: jest.fn(async () => undefined),
      };
      const service = new EngagementsService(
        em as never,
        mockOutbox() as never,
        mockNotifications() as never,
        { presignDownload: jest.fn() } as never,
      );
      jest.spyOn(service, 'getOne').mockResolvedValue({ id: 'e1' } as never);

      await service.update('e1', { title: 'New title' }, staffLead);
      expect(engagement.title).toBe('New title');
    });

    it('rejects a Staff Member from updating the engagement', async () => {
      const em = {
        findOne: jest.fn(async () => null), // not Lead
        findOneOrFail: jest.fn(),
      };
      const service = new EngagementsService(
        em as never,
        mockOutbox() as never,
        mockNotifications() as never,
        { presignDownload: jest.fn() } as never,
      );

      await expect(
        service.update('e1', { title: 'Nope' }, staffMember),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(em.findOneOrFail).not.toHaveBeenCalled();
    });

    it('allows the creating Super Admin to transition', async () => {
      const engagement = {
        stage: EngagementStage.Planning,
        referenceCode: 'ENG-1',
        completedAt: null as Date | null,
        createdBy: { id: sa.userId },
      };
      const em = {
        findOne: jest.fn(async (entity: unknown) => {
          if (entity === EngagementEntity) return engagement;
          return null;
        }),
        findOneOrFail: jest.fn(async () => engagement),
        create: jest.fn(),
        flush: jest.fn(async () => undefined),
        getReference: jest.fn((_e: unknown, id: unknown) => ({ id })),
        find: jest.fn(async () => []),
      };
      const service = new EngagementsService(
        em as never,
        mockOutbox() as never,
        mockNotifications() as never,
        { presignDownload: jest.fn() } as never,
      );
      jest.spyOn(service, 'getOne').mockResolvedValue({ id: 'e1' } as never);

      await service.transition(
        'e1',
        { toStage: EngagementStage.Execution },
        sa,
      );
      expect(engagement.stage).toBe(EngagementStage.Execution);
    });

    it('rejects a Super Admin who did not create the engagement', async () => {
      const engagement = {
        stage: EngagementStage.Planning,
        createdBy: { id: 'other-sa' },
      };
      const em = {
        findOne: jest.fn(async (entity: unknown) => {
          if (entity === EngagementEntity) return engagement;
          return { memberRole: EngagementMemberRole.Lead };
        }),
        findOneOrFail: jest.fn(),
      };
      const service = new EngagementsService(
        em as never,
        mockOutbox() as never,
        mockNotifications() as never,
        { presignDownload: jest.fn() } as never,
      );

      await expect(
        service.transition('e1', { toStage: EngagementStage.Execution }, sa),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(em.findOneOrFail).not.toHaveBeenCalled();
    });

    it('rejects an engagement Lead from transitioning stage', async () => {
      const engagement = {
        stage: EngagementStage.Planning,
        createdBy: { id: sa.userId },
      };
      const em = {
        findOne: jest.fn(async (entity: unknown) => {
          if (entity === EngagementEntity) return engagement;
          return { memberRole: EngagementMemberRole.Lead };
        }),
        findOneOrFail: jest.fn(),
      };
      const service = new EngagementsService(
        em as never,
        mockOutbox() as never,
        mockNotifications() as never,
        { presignDownload: jest.fn() } as never,
      );

      await expect(
        service.transition(
          'e1',
          { toStage: EngagementStage.Execution },
          staffLead,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(em.findOneOrFail).not.toHaveBeenCalled();
    });
  });
});
