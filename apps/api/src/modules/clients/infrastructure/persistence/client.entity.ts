import { Entity, ManyToOne, OneToOne, Property } from '@mikro-orm/core';
import { BaseEntity } from '../../../../database/base.entity';
import { ClientTypeEntity } from '../../../reference/infrastructure/persistence/client-types.entity';
import { UserEntity } from '../../../users/infrastructure/persistence/user.entity';

@Entity({ tableName: 'clients' })
export class ClientEntity extends BaseEntity {
  @Property({ unique: true })
  name!: string;

  @ManyToOne(() => ClientTypeEntity, { nullable: true })
  clientType?: ClientTypeEntity | null;

  @Property({ nullable: true })
  companyName?: string | null;

  @Property({ nullable: true })
  companyRegisteredAddress?: string | null;

  @Property({ type: 'date', nullable: true })
  incorporationDate?: Date | null;

  @Property({ nullable: true })
  incorporationNo?: string | null;

  @Property({ nullable: true })
  officialAddress?: string | null;

  @Property({ nullable: true })
  residentialAddress?: string | null;

  @Property({ nullable: true })
  email?: string | null;

  @Property({ nullable: true })
  phoneNumber?: string | null;

  /** The primary contact user (login) for this client. */
  @OneToOne(() => UserEntity, { nullable: true, owner: true })
  primaryContact?: UserEntity | null;

  @Property({ default: true })
  isActive: boolean = true;
}
