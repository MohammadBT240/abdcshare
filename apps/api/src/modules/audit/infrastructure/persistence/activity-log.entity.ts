import {
  Entity,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
} from "@mikro-orm/core";
import { randomUUID } from "node:crypto";
import { UserEntity } from "../../../users/infrastructure/persistence/user.entity";

@Entity({ tableName: "activity_log" })
@Index({ properties: ["entityType", "entityId"] })
export class ActivityLogEntity {
  @PrimaryKey({ type: "uuid" })
  id: string = randomUUID();

  // null actor = system action
  @ManyToOne(() => UserEntity, { nullable: true })
  actor?: UserEntity | null;

  @Property()
  action!: string;

  @Property()
  entityType!: string;

  @Property({ type: "uuid", nullable: true })
  entityId?: string | null;

  @Property({ nullable: true })
  ipAddress?: string | null;

  @Property({ type: "json", nullable: true })
  metadata?: Record<string, unknown> | null;

  @Property({ type: "timestamptz" })
  createdAt: Date = new Date();
}
