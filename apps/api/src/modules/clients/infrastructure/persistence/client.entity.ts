import { Entity, Property } from '@mikro-orm/core';
import { BaseEntity } from '../../../../database/base.entity';

@Entity({ tableName: 'clients' })
export class ClientEntity extends BaseEntity {
  @Property({ unique: true })
  name!: string;

  @Property({ nullable: true })
  contactEmail?: string;

  @Property({ nullable: true })
  phone?: string;

  @Property({ default: true })
  isActive: boolean = true;
}
