import { Migration } from '@mikro-orm/migrations';

/** Presigned R2 URLs exceed varchar(255); keep room for long links / query strings. */
export class Migration20260804083000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "notifications" alter column "link" type text using ("link"::text);`);
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "notifications" alter column "link" type varchar(255) using (left("link", 255));`,
    );
  }
}
