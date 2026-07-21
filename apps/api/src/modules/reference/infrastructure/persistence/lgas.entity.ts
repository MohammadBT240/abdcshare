import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { StateEntity } from './states.entity';

@Entity({ tableName: 'lgas' })
export class LgaEntity {
  @PrimaryKey()
  id!: number;

  @ManyToOne(() => StateEntity)
  state!: StateEntity;

  @Property()
  name!: string;

  @Property({ default: true })
  isActive: boolean = true;
}
