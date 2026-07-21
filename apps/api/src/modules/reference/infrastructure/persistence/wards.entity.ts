import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { LgaEntity } from './lgas.entity';

@Entity({ tableName: 'wards' })
export class WardEntity {
  @PrimaryKey()
  id!: number;

  @ManyToOne(() => LgaEntity)
  lga!: LgaEntity;

  @Property()
  name!: string;

  @Property({ default: true })
  isActive: boolean = true;
}
