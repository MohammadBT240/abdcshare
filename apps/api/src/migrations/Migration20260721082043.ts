import { Migration } from '@mikro-orm/migrations';

export class Migration20260721082043 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "company_profile" alter column "id" type int using ("id"::int);`);
    this.addSql(`alter table "company_profile" alter column "id" set default 1;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "company_profile" alter column "id" drop default;`);
    this.addSql(`alter table "company_profile" alter column "id" type int4 using ("id"::int4);`);
  }

}
