import { Entity, Enum, ManyToOne, OptionalProps, PrimaryKey, Property } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';
import { SubmissionStatus } from '@abdcshare/shared';
import { ClientSubmissionEntity } from './client-submission.entity';

/** A file attached to a client's response (legacy `client_response_sub`). */
@Entity({ tableName: 'submission_files' })
export class SubmissionFileEntity {
  [OptionalProps]?: 'id' | 'status' | 'uploadedAt';

  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @ManyToOne(() => ClientSubmissionEntity, { deleteRule: 'cascade' })
  submission!: ClientSubmissionEntity;

  @Property()
  storageKey!: string;

  @Property()
  fileName!: string;

  @Property({ nullable: true })
  mimeType?: string | null;

  @Property({ nullable: true })
  sizeBytes?: number | null;

  @Enum({ items: () => SubmissionStatus })
  status: SubmissionStatus = SubmissionStatus.Pending;

  @Property({ type: 'timestamptz' })
  uploadedAt: Date = new Date();
}
