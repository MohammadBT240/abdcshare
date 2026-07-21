import { Entity, ManyToOne, OptionalProps, PrimaryKey, Property } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';
import { DocumentEntity } from './document.entity';
import { UserEntity } from '../../../users/infrastructure/persistence/user.entity';

/** One uploaded file version of a document. */
@Entity({ tableName: 'document_files' })
export class DocumentFileEntity {
  [OptionalProps]?: 'id' | 'uploadedAt';

  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @ManyToOne(() => DocumentEntity, { deleteRule: 'cascade' })
  document!: DocumentEntity;

  @Property()
  version!: number;

  @Property()
  storageKey!: string;

  @Property()
  fileName!: string;

  @Property({ nullable: true })
  mimeType?: string | null;

  @Property({ nullable: true })
  sizeBytes?: number | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  uploadedBy?: UserEntity | null;

  @Property({ type: 'timestamptz' })
  uploadedAt: Date = new Date();
}
