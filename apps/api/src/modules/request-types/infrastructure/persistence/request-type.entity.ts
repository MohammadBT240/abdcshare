import { Entity, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/core';
import { RequestClassEntity } from '../../../request-classes/infrastructure/persistence/request-class.entity';

@Entity({ tableName: 'request_types' })
@Unique({ properties: ['requestClass', 'name'] })
export class RequestTypeEntity {
  @PrimaryKey()
  id!: number;

  @ManyToOne(() => RequestClassEntity)
  requestClass!: RequestClassEntity;

  @Property()
  name!: string;

  @Property({ default: 1 })
  expectedDocuments: number = 1;

  @Property({ default: true })
  isActive: boolean = true;
}
