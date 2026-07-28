import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, type FilterQuery } from '@mikro-orm/postgresql';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import {
  EVENT,
  hasPermission,
  PartnerReportInviteStatus,
  PartnerReportStatus,
  type Paginated,
} from '@abdcshare/shared';
import { pageParams, paginated } from '../../common/pagination/paginate';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { OutboxService } from '../outbox/outbox.service';
import { NotificationsService, type NotifyRecipient } from '../notifications/notifications.service';
import { UserEntity } from '../users/infrastructure/persistence/user.entity';
import { RoleEntity } from '../roles/infrastructure/persistence/role.entity';
import { PartnerReportEntity } from './infrastructure/persistence/partner-report.entity';
import { PartnerReportInviteEntity } from './infrastructure/persistence/partner-report-invite.entity';
import { PartnerReportEngagementUpdateEntity } from './infrastructure/persistence/partner-report-engagement-update.entity';
import { PartnerReportDecisionEntity } from './infrastructure/persistence/partner-report-decision.entity';
import type {
  CreateInviteDto,
  ReportListQueryDto,
  ReviewReportDto,
  SaveReportDto,
} from './presentation/dto/partner-report.dto';
import { InviteResponseDto, InviteResultDto, PartnerReportResponseDto } from './presentation/dto/partner-report.dto';

const GUEST_ROLE = 'Guest';
const REPORT_POPULATE = ['submittedBy', 'engagementUpdates', 'decisions'] as const;

@Injectable()
export class PartnerReportsService {
  constructor(
    private readonly em: EntityManager,
    private readonly outbox: OutboxService,
    private readonly notifications: NotificationsService,
  ) {}

  private canSeeAll(user: AuthenticatedUser): boolean {
    return hasPermission(user.role, 'partner-report:view-all', user.partnerDesignation);
  }

  /** The Chairman(s) to notify — active Principal Partner(s). */
  private async chairmanRecipients(): Promise<NotifyRecipient[]> {
    const pps = await this.em.find(UserEntity, { partnerDesignation: 'PrincipalPartner', isActive: true });
    return pps.map((u) => ({ userId: u.id, email: u.email ?? null }));
  }

  private toDto(r: PartnerReportEntity): PartnerReportResponseDto {
    return {
      id: r.id,
      submittedById: r.submittedBy.id,
      submittedByName: r.submittedBy.fullName ?? null,
      reportingOfficerName: r.reportingOfficerName,
      officerTitle: r.officerTitle,
      department: r.department,
      periodType: r.periodType,
      periodLabel: r.periodLabel ?? null,
      executiveSummary: r.executiveSummary ?? null,
      currency: r.currency ?? null,
      feeRevenue: r.feeRevenue ?? null,
      billingsRaised: r.billingsRaised ?? null,
      collectionsReceived: r.collectionsReceived ?? null,
      outstandingWip: r.outstandingWip ?? null,
      varianceVsBudget: r.varianceVsBudget ?? null,
      peopleCapacity: r.peopleCapacity ?? null,
      outlook: r.outlook ?? null,
      status: r.status,
      submittedAt: r.submittedAt ?? null,
      reviewNotes: r.reviewNotes ?? null,
      reviewedAt: r.reviewedAt ?? null,
      isGuest: r.invite != null,
      engagementUpdates: r.engagementUpdates.getItems().map((u) => ({
        clientEngagement: u.clientEngagement,
        update: u.update,
        status: u.status,
      })),
      decisions: r.decisions.getItems().map((d) => ({ decision: d.decision, priority: d.priority })),
      createdAt: r.createdAt,
    };
  }

  private async loadOwnedOrAll(id: string, user: AuthenticatedUser): Promise<PartnerReportEntity> {
    const where = this.canSeeAll(user) ? { id } : { id, submittedBy: user.userId };
    const report = await this.em.findOne(PartnerReportEntity, where as FilterQuery<PartnerReportEntity>, {
      populate: [...REPORT_POPULATE, 'invite'],
    });
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  // ---- Invite a Guest (Principal Partner) ---------------------------------

  /** Nudge an existing user to submit a report (no new account created). */
  private async remindToSubmit(user: UserEntity, actorId: string): Promise<void> {
    await this.notifications.emit({
      recipients: [{ userId: user.id, email: user.email ?? null }],
      type: 'partner-report.reminder',
      title: 'Reminder: the Chairman is awaiting your report',
      body: 'Please submit your report when you have a moment.',
      entityType: 'partner-report',
      link: '/partner-reports',
      excludeUserId: actorId,
    });
  }

  async createInvite(dto: CreateInviteDto, pp: AuthenticatedUser): Promise<InviteResultDto> {
    const email = dto.email.toLowerCase();
    // If the email is already a user, don't create a duplicate — remind them instead.
    const existing = await this.em.findOne(UserEntity, { email });
    if (existing) {
      await this.remindToSubmit(existing, pp.userId);
      await this.em.flush();
      return { outcome: 'reminded', email, userId: existing.id, inviteId: null };
    }
    const guestRole = await this.em.findOne(RoleEntity, { roleName: GUEST_ROLE });
    if (!guestRole) throw new NotFoundException('Guest role is not seeded');

    const parts = dto.fullName.trim().split(/\s+/);
    const firstName = parts[0] ?? dto.fullName;
    const surname = parts.length > 1 ? parts.slice(1).join(' ') : parts[0] ?? dto.fullName;
    const tempPassword = randomBytes(9).toString('base64url');

    const guest = this.em.create(UserEntity, {
      role: guestRole,
      firstName,
      middleName: null,
      surname,
      fullName: dto.fullName.trim(),
      email,
      passwordHash: await bcrypt.hash(tempPassword, 12),
      mustChangePassword: true,
      isActive: true,
    });
    const invite = this.em.create(PartnerReportInviteEntity, {
      invitedBy: this.em.getReference(UserEntity, pp.userId),
      guestUser: guest,
      email,
      status: PartnerReportInviteStatus.Invited,
    });
    // Worker emails the credentials + login link (same path as any created user).
    this.outbox.enqueue(EVENT.UserCreated, { userId: guest.id, email, tempPassword });
    this.outbox.enqueue(EVENT.PartnerReportInvited, { inviteId: invite.id, email });
    await this.em.persistAndFlush(invite);
    return { outcome: 'invited', email, userId: guest.id, inviteId: invite.id };
  }

  private inviteDto(i: PartnerReportInviteEntity): InviteResponseDto {
    return { id: i.id, email: i.email, guestUserId: i.guestUser.id, status: i.status, createdAt: i.createdAt };
  }

  async listInvites(pp: AuthenticatedUser, query: ReportListQueryDto): Promise<Paginated<InviteResponseDto>> {
    const { page, pageSize, limit, offset } = pageParams(query);
    const [rows, total] = await this.em.findAndCount(
      PartnerReportInviteEntity,
      { invitedBy: pp.userId } as FilterQuery<PartnerReportInviteEntity>,
      { populate: ['guestUser'], orderBy: { createdAt: 'desc' }, limit, offset },
    );
    return paginated(rows.map((i) => this.inviteDto(i)), total, page, pageSize);
  }

  // ---- Report authoring ----------------------------------------------------

  private applyRows(report: PartnerReportEntity, dto: SaveReportDto): void {
    (dto.engagementUpdates ?? []).forEach((u, i) => {
      this.em.create(PartnerReportEngagementUpdateEntity, {
        report,
        clientEngagement: u.clientEngagement,
        update: u.update,
        status: u.status,
        sortOrder: i,
      });
    });
    (dto.decisions ?? []).forEach((d, i) => {
      this.em.create(PartnerReportDecisionEntity, {
        report,
        decision: d.decision,
        priority: d.priority,
        sortOrder: i,
      });
    });
  }

  private assignScalars(report: PartnerReportEntity, dto: SaveReportDto): void {
    report.reportingOfficerName = dto.reportingOfficerName;
    report.officerTitle = dto.officerTitle;
    report.department = dto.department;
    report.periodType = dto.periodType;
    report.periodLabel = dto.periodLabel ?? null;
    report.executiveSummary = dto.executiveSummary ?? null;
    report.currency = dto.currency ?? null;
    report.feeRevenue = dto.feeRevenue ?? null;
    report.billingsRaised = dto.billingsRaised ?? null;
    report.collectionsReceived = dto.collectionsReceived ?? null;
    report.outstandingWip = dto.outstandingWip ?? null;
    report.varianceVsBudget = dto.varianceVsBudget ?? null;
    report.peopleCapacity = dto.peopleCapacity ?? null;
    report.outlook = dto.outlook ?? null;
  }

  /** Create a draft report authored by the caller (partner or invited guest). */
  async create(dto: SaveReportDto, user: AuthenticatedUser): Promise<PartnerReportResponseDto> {
    const report = this.em.create(PartnerReportEntity, {
      submittedBy: this.em.getReference(UserEntity, user.userId),
      reportingOfficerName: dto.reportingOfficerName,
      officerTitle: dto.officerTitle,
      department: dto.department,
      periodType: dto.periodType,
      status: PartnerReportStatus.Draft,
    });
    this.assignScalars(report, dto);
    // Link a guest's report to their invite.
    const invite = await this.em.findOne(PartnerReportInviteEntity, {
      guestUser: user.userId,
      status: PartnerReportInviteStatus.Invited,
    });
    if (invite) report.invite = invite;
    this.applyRows(report, dto);
    await this.em.persistAndFlush(report);
    return this.getOne(report.id, user);
  }

  async update(id: string, dto: SaveReportDto, user: AuthenticatedUser): Promise<PartnerReportResponseDto> {
    const report = await this.loadOwnedOrAll(id, user);
    if (report.status !== PartnerReportStatus.Draft) {
      throw new BadRequestException('Only a draft report can be edited');
    }
    this.assignScalars(report, dto);
    // Replace child rows.
    await this.em.nativeDelete(PartnerReportEngagementUpdateEntity, { report: id });
    await this.em.nativeDelete(PartnerReportDecisionEntity, { report: id });
    this.applyRows(report, dto);
    await this.em.flush();
    return this.getOne(id, user);
  }

  async submit(id: string, user: AuthenticatedUser): Promise<PartnerReportResponseDto> {
    const report = await this.loadOwnedOrAll(id, user);
    if (report.status !== PartnerReportStatus.Draft) {
      throw new BadRequestException(`Report already ${report.status}`);
    }
    report.status = PartnerReportStatus.Submitted;
    report.submittedAt = new Date();
    if (report.invite) report.invite.status = PartnerReportInviteStatus.Submitted;
    await this.notifications.emit({
      recipients: await this.chairmanRecipients(),
      type: 'partner-report.submitted',
      title: `Report submitted: ${report.reportingOfficerName}`,
      body: report.executiveSummary?.slice(0, 140),
      entityType: 'partner-report',
      entityId: report.id,
      link: `/partner-reports/${report.id}`,
      excludeUserId: user.userId,
    });
    this.outbox.enqueue(EVENT.PartnerReportSubmitted, { reportId: report.id });
    await this.em.flush();
    return this.getOne(id, user);
  }

  async list(query: ReportListQueryDto, user: AuthenticatedUser): Promise<Paginated<PartnerReportResponseDto>> {
    const where: Record<string, unknown> = this.canSeeAll(user) ? {} : { submittedBy: user.userId };
    if (query.status) where.status = query.status;
    if (query.periodType) where.periodType = query.periodType;

    const { page, pageSize, limit, offset } = pageParams(query);
    const [rows, total] = await this.em.findAndCount(
      PartnerReportEntity,
      where as FilterQuery<PartnerReportEntity>,
      { populate: [...REPORT_POPULATE, 'invite'], orderBy: { createdAt: 'desc' }, limit, offset },
    );
    return paginated(rows.map((r) => this.toDto(r)), total, page, pageSize);
  }

  async getOne(id: string, user: AuthenticatedUser): Promise<PartnerReportResponseDto> {
    return this.toDto(await this.loadOwnedOrAll(id, user));
  }

  /** Chairman reviews a submitted report. */
  async review(id: string, dto: ReviewReportDto, pp: AuthenticatedUser): Promise<PartnerReportResponseDto> {
    const report = await this.em.findOne(PartnerReportEntity, { id }, { populate: [...REPORT_POPULATE, 'invite'] });
    if (!report) throw new NotFoundException('Report not found');
    if (report.status !== PartnerReportStatus.Submitted) {
      throw new BadRequestException('Only a submitted report can be reviewed');
    }
    report.status = PartnerReportStatus.Reviewed;
    report.reviewedBy = this.em.getReference(UserEntity, pp.userId);
    report.reviewNotes = dto.notes ?? null;
    report.reviewedAt = new Date();
    await this.notifications.emit({
      recipients: [{ userId: report.submittedBy.id, email: report.submittedBy.email ?? null }],
      type: 'partner-report.reviewed',
      title: 'The Chairman reviewed your report',
      body: dto.notes,
      entityType: 'partner-report',
      entityId: report.id,
      link: `/partner-reports/${report.id}`,
      excludeUserId: pp.userId,
    });
    await this.em.flush();
    return this.toDto(report);
  }

  /** Chairman dashboard headline counts. */
  async dashboard(): Promise<Record<string, number>> {
    const [total, drafts, submitted, reviewed] = await Promise.all([
      this.em.count(PartnerReportEntity, {}),
      this.em.count(PartnerReportEntity, { status: PartnerReportStatus.Draft }),
      this.em.count(PartnerReportEntity, { status: PartnerReportStatus.Submitted }),
      this.em.count(PartnerReportEntity, { status: PartnerReportStatus.Reviewed }),
    ]);
    const awaitingDecision = await this.em.count(PartnerReportDecisionEntity, {
      report: { status: PartnerReportStatus.Submitted },
    } as FilterQuery<PartnerReportDecisionEntity>);
    return { total, drafts, awaitingReview: submitted, reviewed, awaitingDecision };
  }
}
