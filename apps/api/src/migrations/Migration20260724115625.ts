import { Migration } from '@mikro-orm/migrations';

export class Migration20260724115625 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "engagements" drop constraint if exists "engagements_status_check";`);

    this.addSql(`alter table "engagement_status_history" drop constraint if exists "engagement_status_history_from_status_check";`);
    this.addSql(`alter table "engagement_status_history" drop constraint if exists "engagement_status_history_to_status_check";`);

    this.addSql(`alter table "documents" drop constraint if exists "documents_category_check";`);

    this.addSql(`alter table "documents" drop constraint "documents_request_class_id_foreign";`);

    // Data fix: rename old lifecycle values before re-adding the check constraints.
    this.addSql(`update "engagements" set "status" = 'Execution' where "status" = 'Fieldwork';`);
    this.addSql(`update "engagements" set "status" = 'Reporting' where "status" = 'Review';`);
    this.addSql(`update "engagement_status_history" set "from_status" = 'Execution' where "from_status" = 'Fieldwork';`);
    this.addSql(`update "engagement_status_history" set "from_status" = 'Reporting' where "from_status" = 'Review';`);
    this.addSql(`update "engagement_status_history" set "to_status" = 'Execution' where "to_status" = 'Fieldwork';`);
    this.addSql(`update "engagement_status_history" set "to_status" = 'Reporting' where "to_status" = 'Review';`);
    this.addSql(`alter table "engagements" add constraint "engagements_status_check" check("status" in ('Planning', 'Execution', 'Reporting', 'Completed', 'Archived'));`);

    this.addSql(`alter table "requests" add column "phase" text check ("phase" in ('Planning', 'Execution', 'Reporting')) null;`);

    this.addSql(`alter table "engagement_status_history" add constraint "engagement_status_history_from_status_check" check("from_status" in ('Planning', 'Execution', 'Reporting', 'Completed', 'Archived'));`);
    this.addSql(`alter table "engagement_status_history" add constraint "engagement_status_history_to_status_check" check("to_status" in ('Planning', 'Execution', 'Reporting', 'Completed', 'Archived'));`);

    this.addSql(`alter table "documents" add column "phase" text check ("phase" in ('Planning', 'Execution', 'Reporting')) null;`);
    this.addSql(`alter table "documents" alter column "request_class_id" type int using ("request_class_id"::int);`);
    this.addSql(`alter table "documents" alter column "request_class_id" drop not null;`);
    this.addSql(`alter table "documents" add constraint "documents_category_check" check("category" in ('WorkingPaper', 'FinalReport', 'Supporting'));`);
    this.addSql(`alter table "documents" add constraint "documents_request_class_id_foreign" foreign key ("request_class_id") references "request_classes" ("id") on update cascade on delete set null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "engagements" drop constraint if exists "engagements_status_check";`);

    this.addSql(`alter table "engagement_status_history" drop constraint if exists "engagement_status_history_from_status_check";`);
    this.addSql(`alter table "engagement_status_history" drop constraint if exists "engagement_status_history_to_status_check";`);

    this.addSql(`alter table "documents" drop constraint if exists "documents_category_check";`);

    this.addSql(`alter table "documents" drop constraint "documents_request_class_id_foreign";`);

    this.addSql(`update "engagements" set "status" = 'Fieldwork' where "status" = 'Execution';`);
    this.addSql(`update "engagements" set "status" = 'Review' where "status" = 'Reporting';`);
    this.addSql(`update "engagement_status_history" set "from_status" = 'Fieldwork' where "from_status" = 'Execution';`);
    this.addSql(`update "engagement_status_history" set "from_status" = 'Review' where "from_status" = 'Reporting';`);
    this.addSql(`update "engagement_status_history" set "to_status" = 'Fieldwork' where "to_status" = 'Execution';`);
    this.addSql(`update "engagement_status_history" set "to_status" = 'Review' where "to_status" = 'Reporting';`);
    this.addSql(`alter table "engagements" add constraint "engagements_status_check" check("status" in ('Planning', 'Fieldwork', 'Review', 'Completed', 'Archived'));`);

    this.addSql(`alter table "requests" drop column "phase";`);

    this.addSql(`alter table "engagement_status_history" add constraint "engagement_status_history_from_status_check" check("from_status" in ('Planning', 'Fieldwork', 'Review', 'Completed', 'Archived'));`);
    this.addSql(`alter table "engagement_status_history" add constraint "engagement_status_history_to_status_check" check("to_status" in ('Planning', 'Fieldwork', 'Review', 'Completed', 'Archived'));`);

    this.addSql(`alter table "documents" drop column "phase";`);

    this.addSql(`alter table "documents" alter column "request_class_id" type int using ("request_class_id"::int);`);
    this.addSql(`alter table "documents" alter column "request_class_id" set not null;`);
    this.addSql(`alter table "documents" add constraint "documents_category_check" check("category" in ('WorkingPaper', 'FinalReport'));`);
    this.addSql(`alter table "documents" add constraint "documents_request_class_id_foreign" foreign key ("request_class_id") references "request_classes" ("id") on update cascade;`);
  }

}
