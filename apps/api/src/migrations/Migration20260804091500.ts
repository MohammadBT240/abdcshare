import { Migration } from '@mikro-orm/migrations';

/** Allow UnderReview on submission files (and parent table for enum parity). */
export class Migration20260804091500 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "client_submissions" drop constraint if exists "client_submissions_status_check";`,
    );
    this.addSql(
      `alter table "submission_files" drop constraint if exists "submission_files_status_check";`,
    );

    this.addSql(
      `alter table "client_submissions" add constraint "client_submissions_status_check" check ("status" in ('Draft', 'Pending', 'UnderReview', 'Accepted', 'Returned'));`,
    );
    this.addSql(
      `alter table "submission_files" add constraint "submission_files_status_check" check ("status" in ('Draft', 'Pending', 'UnderReview', 'Accepted', 'Returned'));`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `update "submission_files" set "status" = 'Pending' where "status" = 'UnderReview';`,
    );
    this.addSql(
      `update "client_submissions" set "status" = 'Pending' where "status" = 'UnderReview';`,
    );

    this.addSql(
      `alter table "client_submissions" drop constraint if exists "client_submissions_status_check";`,
    );
    this.addSql(
      `alter table "submission_files" drop constraint if exists "submission_files_status_check";`,
    );

    this.addSql(
      `alter table "client_submissions" add constraint "client_submissions_status_check" check ("status" in ('Draft', 'Pending', 'Accepted', 'Returned'));`,
    );
    this.addSql(
      `alter table "submission_files" add constraint "submission_files_status_check" check ("status" in ('Draft', 'Pending', 'Accepted', 'Returned'));`,
    );
  }
}
