import { Migration } from '@mikro-orm/migrations';

/**
 * Rename engagement lifecycle column status → stage (and history from/to columns).
 * Check-constraint values stay the same (Planning / Execution / Reporting / Completed / Archived).
 */
export class Migration20260801143000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "engagements" drop constraint if exists "engagements_status_check";`);
    this.addSql(
      `alter table "engagement_status_history" drop constraint if exists "engagement_status_history_from_status_check";`,
    );
    this.addSql(
      `alter table "engagement_status_history" drop constraint if exists "engagement_status_history_to_status_check";`,
    );

    this.addSql(`alter table "engagements" rename column "status" to "stage";`);
    this.addSql(`alter table "engagement_status_history" rename column "from_status" to "from_stage";`);
    this.addSql(`alter table "engagement_status_history" rename column "to_status" to "to_stage";`);

    this.addSql(
      `alter table "engagements" add constraint "engagements_stage_check" check("stage" in ('Planning', 'Execution', 'Reporting', 'Completed', 'Archived'));`,
    );
    this.addSql(
      `alter table "engagement_status_history" add constraint "engagement_status_history_from_stage_check" check("from_stage" in ('Planning', 'Execution', 'Reporting', 'Completed', 'Archived'));`,
    );
    this.addSql(
      `alter table "engagement_status_history" add constraint "engagement_status_history_to_stage_check" check("to_stage" in ('Planning', 'Execution', 'Reporting', 'Completed', 'Archived'));`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "engagements" drop constraint if exists "engagements_stage_check";`);
    this.addSql(
      `alter table "engagement_status_history" drop constraint if exists "engagement_status_history_from_stage_check";`,
    );
    this.addSql(
      `alter table "engagement_status_history" drop constraint if exists "engagement_status_history_to_stage_check";`,
    );

    this.addSql(`alter table "engagements" rename column "stage" to "status";`);
    this.addSql(`alter table "engagement_status_history" rename column "from_stage" to "from_status";`);
    this.addSql(`alter table "engagement_status_history" rename column "to_stage" to "to_status";`);

    this.addSql(
      `alter table "engagements" add constraint "engagements_status_check" check("status" in ('Planning', 'Execution', 'Reporting', 'Completed', 'Archived'));`,
    );
    this.addSql(
      `alter table "engagement_status_history" add constraint "engagement_status_history_from_status_check" check("from_status" in ('Planning', 'Execution', 'Reporting', 'Completed', 'Archived'));`,
    );
    this.addSql(
      `alter table "engagement_status_history" add constraint "engagement_status_history_to_status_check" check("to_status" in ('Planning', 'Execution', 'Reporting', 'Completed', 'Archived'));`,
    );
  }
}
