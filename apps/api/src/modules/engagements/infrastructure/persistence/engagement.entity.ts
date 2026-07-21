import { Collection, Entity, Enum, ManyToOne, OneToMany, Property } from '@mikro-orm/core';
import { EngagementStatus } from '@abdcshare/shared';
import { BaseEntity } from '../../../../database/base.entity';
import { ClientEntity } from '../../../clients/infrastructure/persistence/client.entity';
import { EngagementTypeEntity } from '../../../engagement-types/infrastructure/persistence/engagement-type.entity';
import { DepartmentEntity } from '../../../departments/infrastructure/persistence/department.entity';
import { UserEntity } from '../../../users/infrastructure/persistence/user.entity';
import { EngagementTeamMemberEntity } from './engagement-team-member.entity';
import { EngagementRequestClassEntity } from './engagement-request-class.entity';

@Entity({ tableName: 'engagements' })
export class EngagementEntity extends BaseEntity {
  @ManyToOne(() => ClientEntity)
  client!: ClientEntity;

  @ManyToOne(() => EngagementTypeEntity)
  engagementType!: EngagementTypeEntity;

  /** Owning department (single). Cross-department people join via the team. */
  @ManyToOne(() => DepartmentEntity)
  department!: DepartmentEntity;

  @Property({ unique: true })
  referenceCode!: string;

  @Property()
  title!: string;

  @Property({ nullable: true })
  periodLabel?: string | null;

  @Enum({ items: () => EngagementStatus })
  status: EngagementStatus = EngagementStatus.Planning;

  @Property({ type: 'date', nullable: true })
  startDate?: Date | null;

  @Property({ type: 'date', nullable: true })
  targetCompletionDate?: Date | null;

  @Property({ type: 'timestamptz', nullable: true })
  completedAt?: Date | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  createdBy?: UserEntity | null;

  @OneToMany(() => EngagementTeamMemberEntity, (tm) => tm.engagement)
  team = new Collection<EngagementTeamMemberEntity>(this);

  @OneToMany(() => EngagementRequestClassEntity, (fl) => fl.engagement)
  requestClasses = new Collection<EngagementRequestClassEntity>(this);
}
