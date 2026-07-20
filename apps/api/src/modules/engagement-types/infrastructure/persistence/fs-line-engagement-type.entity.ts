import { Entity, ManyToOne, PrimaryKeyProp } from '@mikro-orm/core';
import { FsLineEntity } from '../../../fs-lines/infrastructure/persistence/fs-line.entity';
import { EngagementTypeEntity } from './engagement-type.entity';

// Which FS lines are allowed per engagement type (empty set ⇒ all allowed).
@Entity({ tableName: 'fs_line_engagement_types' })
export class FsLineEngagementTypeEntity {
  @ManyToOne(() => FsLineEntity, { primary: true })
  fsLine!: FsLineEntity;

  @ManyToOne(() => EngagementTypeEntity, { primary: true })
  engagementType!: EngagementTypeEntity;

  [PrimaryKeyProp]?: ['fsLine', 'engagementType'];
}
