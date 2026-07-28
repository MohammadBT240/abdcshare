import { Entity, Enum, ManyToOne, Property } from '@mikro-orm/core';
import { PartnerReportInviteStatus } from '@abdcshare/shared';
import { BaseEntity } from '../../../../database/base.entity';
import { UserEntity } from '../../../users/infrastructure/persistence/user.entity';

/**
 * Records that the Principal Partner invited someone to submit a report. The
 * invitee is provisioned as a `Guest` user (temp password + forced change);
 * this row is the provenance + status of that invitation.
 */
@Entity({ tableName: 'partner_report_invites' })
export class PartnerReportInviteEntity extends BaseEntity {
  @ManyToOne(() => UserEntity)
  invitedBy!: UserEntity;

  @ManyToOne(() => UserEntity)
  guestUser!: UserEntity;

  @Property()
  email!: string;

  @Enum({ items: () => PartnerReportInviteStatus })
  status: PartnerReportInviteStatus = PartnerReportInviteStatus.Invited;
}
