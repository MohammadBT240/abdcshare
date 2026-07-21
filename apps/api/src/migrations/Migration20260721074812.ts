import { Migration } from '@mikro-orm/migrations';

export class Migration20260721074812 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "company_profile" alter column "id" type int using ("id"::int);`);
    this.addSql(`create sequence if not exists "company_profile_id_seq";`);
    this.addSql(`select setval('company_profile_id_seq', (select max("id") from "company_profile"));`);
    this.addSql(`alter table "company_profile" alter column "id" set default nextval('company_profile_id_seq');`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "company_profile" alter column "id" type int4 using ("id"::int4);`);
  }

}
