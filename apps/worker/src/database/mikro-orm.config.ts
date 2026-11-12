import 'dotenv/config';
import { defineConfig } from '@mikro-orm/postgresql';
import { NotificationDeliveryEntity, OutboxEntity } from '@abdcshare/persistence';

export default defineConfig({
  clientUrl: process.env.DATABASE_URL,
  entities: [OutboxEntity, NotificationDeliveryEntity],
  discovery: { warnWhenNoEntities: false },
});
