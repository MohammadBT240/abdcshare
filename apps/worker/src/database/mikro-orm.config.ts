import { defineConfig } from '@mikro-orm/postgresql';
import { OutboxEntity } from './outbox.entity';

export default defineConfig({
  clientUrl: process.env.DATABASE_URL,
  entities: [OutboxEntity],
  discovery: { warnWhenNoEntities: false },
});
