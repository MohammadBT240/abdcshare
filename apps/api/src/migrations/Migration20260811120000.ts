import { Migration } from '@mikro-orm/migrations';

/** Company profiles: allow draft rows (create name first, then Uppy confirm file). */
export class Migration20260811120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table "company_profiles"
        alter column "storage_key" drop not null,
        alter column "file_name" drop not null;
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`
      delete from "company_profiles" where "storage_key" is null or "file_name" is null;
    `);
    this.addSql(`
      alter table "company_profiles"
        alter column "storage_key" set not null,
        alter column "file_name" set not null;
    `);
  }
}
