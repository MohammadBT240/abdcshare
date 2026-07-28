import { Migration } from '@mikro-orm/migrations';

export class Migration20260725202010 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "partner_report_invites" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "invited_by_id" uuid not null, "guest_user_id" uuid not null, "email" varchar(255) not null, "status" text check ("status" in ('Invited', 'Submitted', 'Revoked')) not null default 'Invited', constraint "partner_report_invites_pkey" primary key ("id"));`);

    this.addSql(`create table "partner_reports" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "submitted_by_id" uuid not null, "invite_id" uuid null, "reporting_officer_name" varchar(255) not null, "officer_title" text check ("officer_title" in ('Partner', 'Director', 'HeadOfDepartment', 'ManagingConsultant')) not null, "department" varchar(255) not null, "period_type" text check ("period_type" in ('Weekly', 'Monthly', 'Quarterly', 'AdHoc')) not null, "period_label" varchar(255) null, "executive_summary" text null, "currency" text check ("currency" in ('NGN', 'USD')) null, "fee_revenue" numeric(18,2) null, "billings_raised" numeric(18,2) null, "collections_received" numeric(18,2) null, "outstanding_wip" numeric(18,2) null, "variance_vs_budget" varchar(255) null, "people_capacity" text null, "outlook" text null, "status" text check ("status" in ('Draft', 'Submitted', 'Reviewed')) not null default 'Draft', "submitted_at" timestamptz null, "reviewed_by_id" uuid null, "review_notes" text null, "reviewed_at" timestamptz null, constraint "partner_reports_pkey" primary key ("id"));`);

    this.addSql(`create table "partner_report_engagement_updates" ("id" uuid not null, "report_id" uuid not null, "client_engagement" varchar(255) not null, "update" text not null, "status" text check ("status" in ('OnTrack', 'Watch', 'AtRisk', 'NewWin')) not null, "sort_order" int not null default 0, constraint "partner_report_engagement_updates_pkey" primary key ("id"));`);

    this.addSql(`create table "partner_report_decisions" ("id" uuid not null, "report_id" uuid not null, "decision" text not null, "priority" text check ("priority" in ('Urgent', 'ThisPeriod', 'ForInformation')) not null, "sort_order" int not null default 0, constraint "partner_report_decisions_pkey" primary key ("id"));`);

    this.addSql(`alter table "partner_report_invites" add constraint "partner_report_invites_invited_by_id_foreign" foreign key ("invited_by_id") references "users" ("id") on update cascade;`);
    this.addSql(`alter table "partner_report_invites" add constraint "partner_report_invites_guest_user_id_foreign" foreign key ("guest_user_id") references "users" ("id") on update cascade;`);

    this.addSql(`alter table "partner_reports" add constraint "partner_reports_submitted_by_id_foreign" foreign key ("submitted_by_id") references "users" ("id") on update cascade;`);
    this.addSql(`alter table "partner_reports" add constraint "partner_reports_invite_id_foreign" foreign key ("invite_id") references "partner_report_invites" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table "partner_reports" add constraint "partner_reports_reviewed_by_id_foreign" foreign key ("reviewed_by_id") references "users" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table "partner_report_engagement_updates" add constraint "partner_report_engagement_updates_report_id_foreign" foreign key ("report_id") references "partner_reports" ("id") on update cascade on delete cascade;`);

    this.addSql(`alter table "partner_report_decisions" add constraint "partner_report_decisions_report_id_foreign" foreign key ("report_id") references "partner_reports" ("id") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "partner_reports" drop constraint "partner_reports_invite_id_foreign";`);

    this.addSql(`alter table "partner_report_engagement_updates" drop constraint "partner_report_engagement_updates_report_id_foreign";`);

    this.addSql(`alter table "partner_report_decisions" drop constraint "partner_report_decisions_report_id_foreign";`);

    this.addSql(`drop table if exists "partner_report_invites" cascade;`);

    this.addSql(`drop table if exists "partner_reports" cascade;`);

    this.addSql(`drop table if exists "partner_report_engagement_updates" cascade;`);

    this.addSql(`drop table if exists "partner_report_decisions" cascade;`);
  }

}
