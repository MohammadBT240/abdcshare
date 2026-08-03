import { Entity, Enum, ManyToOne, OptionalProps, PrimaryKey, Property } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';
import { FilePreviewStatus, SubmissionStatus } from '@abdcshare/shared';
import { ClientSubmissionEntity } from './client-submission.entity';
import { UserEntity } from '../../../users/infrastructure/persistence/user.entity';

/** A file attached to a client's response (legacy `client_response_sub`). */
@Entity({ tableName: 'submission_files' })
export class SubmissionFileEntity {
  [OptionalProps]?: 'id' | 'status' | 'uploadedAt' | 'previewStatus';

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

  /** Per-file review reason (set when Accepted/Returned). */
  @Property({ type: 'text', nullable: true })
  reviewReason?: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  reviewedBy?: UserEntity | null;

  @Property({ type: 'timestamptz', nullable: true })
  reviewedAt?: Date | null;

  /**
   * Append-only replacement: points at the Returned file this row supersedes.
   * The old row stays for audit; derived status ignores superseded files.
   */
  @ManyToOne(() => SubmissionFileEntity, { nullable: true, deleteRule: 'cascade' })
  replacesFile?: SubmissionFileEntity | null;

  /** Converted PDF (or null when native preview uses `storageKey`). */
  @Property({ nullable: true })
  previewStorageKey?: string | null;

  @Enum({ items: () => FilePreviewStatus })
  previewStatus: FilePreviewStatus = FilePreviewStatus.None;

  @Property({ type: 'text', nullable: true })
  previewError?: string | null;

  @Property({ type: 'timestamptz' })
  uploadedAt: Date = new Date();
}
