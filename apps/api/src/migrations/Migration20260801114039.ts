import { Migration } from '@mikro-orm/migrations';

export class Migration20260801114039 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "company_profiles" alter column "size_bytes" type int using ("size_bytes"::int);`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "company_profiles" alter column "size_bytes" type varchar(255) using ("size_bytes"::varchar(255));`);
  }

}
