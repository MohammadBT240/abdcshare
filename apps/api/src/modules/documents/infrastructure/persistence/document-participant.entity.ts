import { Entity, Enum, ManyToOne, OptionalProps, PrimaryKeyProp, Property } from '@mikro-orm/core';
import { DocumentParticipantRole } from '@abdcshare/shared';
import { DocumentEntity } from './document.entity';
import { UserEntity } from '../../../users/infrastructure/persistence/user.entity';

/** People attached to a document (legacy per-line auditors/advisors/staffs). */
@Entity({ tableName: 'document_participants' })
export class DocumentParticipantEntity {
  [OptionalProps]?: 'addedAt';

  @ManyToOne(() => DocumentEntity, { primary: true, deleteRule: 'cascade' })
  document!: DocumentEntity;

  @ManyToOne(() => UserEntity, { primary: true })
  user!: UserEntity;

  @Enum({ items: () => DocumentParticipantRole })
  participantRole!: DocumentParticipantRole;

  @ManyToOne(() => UserEntity, { nullable: true })
  addedBy?: UserEntity | null;

  @Property({ type: 'timestamptz' })
  addedAt: Date = new Date();

  [PrimaryKeyProp]?: ['document', 'user'];
}
