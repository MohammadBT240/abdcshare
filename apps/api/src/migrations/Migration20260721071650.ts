import { Migration } from '@mikro-orm/migrations';

export class Migration20260721071650 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "banks" ("id" serial primary key, "name" varchar(255) not null, "is_active" boolean not null default true);`);
    this.addSql(`alter table "banks" add constraint "banks_name_unique" unique ("name");`);

    this.addSql(`create table "categories" ("id" serial primary key, "name" varchar(255) not null, "is_active" boolean not null default true);`);
    this.addSql(`alter table "categories" add constraint "categories_name_unique" unique ("name");`);

    this.addSql(`create table "client_types" ("id" serial primary key, "name" varchar(255) not null, "is_active" boolean not null default true);`);
    this.addSql(`alter table "client_types" add constraint "client_types_name_unique" unique ("name");`);

    this.addSql(`create table "departments" ("id" serial primary key, "name" varchar(255) not null, "is_active" boolean not null default true);`);
    this.addSql(`alter table "departments" add constraint "departments_name_unique" unique ("name");`);

    this.addSql(`create table "engagement_types" ("id" serial primary key, "name" varchar(255) not null, "is_active" boolean not null default true);`);
    this.addSql(`alter table "engagement_types" add constraint "engagement_types_name_unique" unique ("name");`);

    this.addSql(`create table "fs_lines" ("id" serial primary key, "code" varchar(255) null, "name" varchar(255) not null, "description" text null, "is_active" boolean not null default true);`);
    this.addSql(`alter table "fs_lines" add constraint "fs_lines_code_unique" unique ("code");`);
    this.addSql(`alter table "fs_lines" add constraint "fs_lines_name_unique" unique ("name");`);

    this.addSql(`create table "fs_line_engagement_types" ("fs_line_id" int not null, "engagement_type_id" int not null, constraint "fs_line_engagement_types_pkey" primary key ("fs_line_id", "engagement_type_id"));`);

    this.addSql(`create table "genders" ("id" serial primary key, "name" varchar(255) not null, "is_active" boolean not null default true);`);
    this.addSql(`alter table "genders" add constraint "genders_name_unique" unique ("name");`);

    this.addSql(`create table "general_statuses" ("id" serial primary key, "name" varchar(255) not null, "is_active" boolean not null default true);`);
    this.addSql(`alter table "general_statuses" add constraint "general_statuses_name_unique" unique ("name");`);

    this.addSql(`create table "industries" ("id" serial primary key, "name" varchar(255) not null, "is_active" boolean not null default true);`);
    this.addSql(`alter table "industries" add constraint "industries_name_unique" unique ("name");`);

    this.addSql(`create table "marital_statuses" ("id" serial primary key, "name" varchar(255) not null, "is_active" boolean not null default true);`);
    this.addSql(`alter table "marital_statuses" add constraint "marital_statuses_name_unique" unique ("name");`);

    this.addSql(`create table "outbox" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "event_type" varchar(255) not null, "payload" jsonb not null, "status" text check ("status" in ('Pending', 'Queued', 'Sent', 'Failed')) not null default 'Pending', "processed_at" timestamptz null, "last_error" text null, constraint "outbox_pkey" primary key ("id"));`);
    this.addSql(`create index "outbox_status_created_at_index" on "outbox" ("status", "created_at");`);

    this.addSql(`create table "request_stages" ("id" serial primary key, "name" varchar(255) not null, "sort_order" int not null default 0, "is_active" boolean not null default true);`);

    this.addSql(`create table "request_statuses" ("id" serial primary key, "name" varchar(255) not null, "sort_order" int not null default 0, "is_active" boolean not null default true);`);

    this.addSql(`create table "request_types" ("id" serial primary key, "fs_line_id" int not null, "name" varchar(255) not null, "expected_documents" int not null default 1, "is_active" boolean not null default true);`);
    this.addSql(`alter table "request_types" add constraint "request_types_fs_line_id_name_unique" unique ("fs_line_id", "name");`);

    this.addSql(`create table "roles" ("id" serial primary key, "role_name" varchar(255) not null);`);
    this.addSql(`alter table "roles" add constraint "roles_role_name_unique" unique ("role_name");`);

    this.addSql(`create table "states" ("id" serial primary key, "name" varchar(255) not null, "is_active" boolean not null default true);`);
    this.addSql(`alter table "states" add constraint "states_name_unique" unique ("name");`);

    this.addSql(`create table "lgas" ("id" serial primary key, "state_id" int not null, "name" varchar(255) not null, "is_active" boolean not null default true);`);

    this.addSql(`create table "titles" ("id" serial primary key, "name" varchar(255) not null, "is_active" boolean not null default true);`);
    this.addSql(`alter table "titles" add constraint "titles_name_unique" unique ("name");`);

    this.addSql(`create table "wards" ("id" serial primary key, "lga_id" int not null, "name" varchar(255) not null, "is_active" boolean not null default true);`);

    this.addSql(`create table "clients" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "name" varchar(255) not null, "client_type_id" int null, "industry_id" int null, "category_id" int null, "company_name" varchar(255) null, "company_registered_address" varchar(255) null, "incorporation_date" date null, "incorporation_no" varchar(255) null, "official_address" varchar(255) null, "residential_address" varchar(255) null, "email" varchar(255) null, "phone_number" varchar(255) null, "bank_id" int null, "state_id" int null, "lga_id" int null, "ward_id" int null, "is_active" boolean not null default true, constraint "clients_pkey" primary key ("id"));`);
    this.addSql(`alter table "clients" add constraint "clients_name_unique" unique ("name");`);

    this.addSql(`create table "users" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "role_id" int not null, "partner_designation" text check ("partner_designation" in ('PrincipalPartner', 'Partner')) null, "department_id" int null, "client_id" uuid null, "title_id" int null, "first_name" varchar(255) not null, "middle_name" varchar(255) null, "surname" varchar(255) not null, "full_name" varchar(255) not null, "gender_id" int null, "marital_status_id" int null, "email" varchar(255) not null, "phone_number" varchar(255) null, "official_address" varchar(255) null, "residential_address" varchar(255) null, "password_hash" varchar(255) not null, "avatar_path" varchar(255) null, "is_active" boolean not null default true, "must_change_password" boolean not null default false, constraint "users_pkey" primary key ("id"));`);
    this.addSql(`create index "users_email_index" on "users" ("email");`);
    this.addSql(`alter table "users" add constraint "users_email_unique" unique ("email");`);

    this.addSql(`create table "refresh_tokens" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_id" uuid not null, "token_hash" varchar(255) not null, "family_id" uuid not null, "user_agent" varchar(255) null, "ip_address" varchar(255) null, "expires_at" timestamptz not null, "revoked_at" timestamptz null, constraint "refresh_tokens_pkey" primary key ("id"));`);
    this.addSql(`create index "refresh_tokens_token_hash_index" on "refresh_tokens" ("token_hash");`);
    this.addSql(`alter table "refresh_tokens" add constraint "refresh_tokens_token_hash_unique" unique ("token_hash");`);

    this.addSql(`create table "password_reset_tokens" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_id" uuid not null, "token_hash" varchar(255) not null, "expires_at" timestamptz not null, "used_at" timestamptz null, constraint "password_reset_tokens_pkey" primary key ("id"));`);
    this.addSql(`alter table "password_reset_tokens" add constraint "password_reset_tokens_token_hash_unique" unique ("token_hash");`);

    this.addSql(`create table "company_profile" ("id" serial primary key, "name" varchar(255) not null, "logo_path" varchar(255) null, "email" varchar(255) null, "phone" varchar(255) null, "address" text null, "updated_by_id" uuid null, "updated_at" timestamptz not null);`);

    this.addSql(`create table "activity_log" ("id" uuid not null, "actor_id" uuid null, "action" varchar(255) not null, "entity_type" varchar(255) not null, "entity_id" uuid null, "ip_address" varchar(255) null, "metadata" jsonb null, "created_at" timestamptz not null, constraint "activity_log_pkey" primary key ("id"));`);
    this.addSql(`create index "activity_log_entity_type_entity_id_index" on "activity_log" ("entity_type", "entity_id");`);

    this.addSql(`alter table "fs_line_engagement_types" add constraint "fs_line_engagement_types_fs_line_id_foreign" foreign key ("fs_line_id") references "fs_lines" ("id") on update cascade;`);
    this.addSql(`alter table "fs_line_engagement_types" add constraint "fs_line_engagement_types_engagement_type_id_foreign" foreign key ("engagement_type_id") references "engagement_types" ("id") on update cascade;`);

    this.addSql(`alter table "request_types" add constraint "request_types_fs_line_id_foreign" foreign key ("fs_line_id") references "fs_lines" ("id") on update cascade;`);

    this.addSql(`alter table "lgas" add constraint "lgas_state_id_foreign" foreign key ("state_id") references "states" ("id") on update cascade;`);

    this.addSql(`alter table "wards" add constraint "wards_lga_id_foreign" foreign key ("lga_id") references "lgas" ("id") on update cascade;`);

    this.addSql(`alter table "clients" add constraint "clients_client_type_id_foreign" foreign key ("client_type_id") references "client_types" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table "clients" add constraint "clients_industry_id_foreign" foreign key ("industry_id") references "industries" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table "clients" add constraint "clients_category_id_foreign" foreign key ("category_id") references "categories" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table "clients" add constraint "clients_bank_id_foreign" foreign key ("bank_id") references "banks" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table "clients" add constraint "clients_state_id_foreign" foreign key ("state_id") references "states" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table "clients" add constraint "clients_lga_id_foreign" foreign key ("lga_id") references "lgas" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table "clients" add constraint "clients_ward_id_foreign" foreign key ("ward_id") references "wards" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table "users" add constraint "users_role_id_foreign" foreign key ("role_id") references "roles" ("id") on update cascade;`);
    this.addSql(`alter table "users" add constraint "users_department_id_foreign" foreign key ("department_id") references "departments" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table "users" add constraint "users_client_id_foreign" foreign key ("client_id") references "clients" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table "users" add constraint "users_title_id_foreign" foreign key ("title_id") references "titles" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table "users" add constraint "users_gender_id_foreign" foreign key ("gender_id") references "genders" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table "users" add constraint "users_marital_status_id_foreign" foreign key ("marital_status_id") references "marital_statuses" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table "refresh_tokens" add constraint "refresh_tokens_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade;`);

    this.addSql(`alter table "password_reset_tokens" add constraint "password_reset_tokens_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade;`);

    this.addSql(`alter table "company_profile" add constraint "company_profile_updated_by_id_foreign" foreign key ("updated_by_id") references "users" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table "activity_log" add constraint "activity_log_actor_id_foreign" foreign key ("actor_id") references "users" ("id") on update cascade on delete set null;`);
  }

}
