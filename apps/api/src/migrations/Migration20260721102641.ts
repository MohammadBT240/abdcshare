import { Migration } from '@mikro-orm/migrations';

export class Migration20260721102641 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "clients" drop constraint "clients_bank_id_foreign";`);
    this.addSql(`alter table "clients" drop constraint "clients_category_id_foreign";`);
    this.addSql(`alter table "clients" drop constraint "clients_industry_id_foreign";`);
    this.addSql(`alter table "clients" drop constraint "clients_lga_id_foreign";`);
    this.addSql(`alter table "clients" drop constraint "clients_state_id_foreign";`);
    this.addSql(`alter table "clients" drop constraint "clients_ward_id_foreign";`);

    this.addSql(`alter table "clients" drop column "industry_id", drop column "category_id", drop column "bank_id", drop column "state_id", drop column "lga_id", drop column "ward_id";`);

    this.addSql(`alter table "clients" add column "primary_contact_id" uuid null;`);
    this.addSql(`alter table "clients" add constraint "clients_primary_contact_id_foreign" foreign key ("primary_contact_id") references "users" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table "clients" add constraint "clients_primary_contact_id_unique" unique ("primary_contact_id");`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "clients" drop constraint "clients_primary_contact_id_foreign";`);

    this.addSql(`alter table "clients" drop constraint "clients_primary_contact_id_unique";`);
    this.addSql(`alter table "clients" drop column "primary_contact_id";`);

    this.addSql(`alter table "clients" add column "industry_id" int4 null, add column "category_id" int4 null, add column "bank_id" int4 null, add column "state_id" int4 null, add column "lga_id" int4 null, add column "ward_id" int4 null;`);
    this.addSql(`alter table "clients" add constraint "clients_industry_id_foreign" foreign key ("industry_id") references "industries" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table "clients" add constraint "clients_category_id_foreign" foreign key ("category_id") references "categories" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table "clients" add constraint "clients_bank_id_foreign" foreign key ("bank_id") references "banks" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table "clients" add constraint "clients_state_id_foreign" foreign key ("state_id") references "states" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table "clients" add constraint "clients_lga_id_foreign" foreign key ("lga_id") references "lgas" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table "clients" add constraint "clients_ward_id_foreign" foreign key ("ward_id") references "wards" ("id") on update cascade on delete set null;`);
  }

}
