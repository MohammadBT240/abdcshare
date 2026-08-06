import { Migration } from '@mikro-orm/migrations';

/**
 * Allow Draft on client submissions + submission files so uploads can complete
 * before staff are notified (atomic finalize). Default new rows to Draft.
 */
export class Migration20260803102358 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "client_submissions" drop constraint if exists "client_submissions_status_check";`,
    );
    this.addSql(
      `alter table "submission_files" drop constraint if exists "submission_files_status_check";`,
    );

    this.addSql(
      `alter table "client_submissions" alter column "status" type text using ("status"::text);`,
    );
    this.addSql(`alter table "client_submissions" alter column "status" set default 'Draft';`);
    this.addSql(
      `alter table "client_submissions" add constraint "client_submissions_status_check" check ("status" in ('Draft', 'Pending', 'Accepted', 'Returned'));`,
    );

    this.addSql(
      `alter table "submission_files" add constraint "submission_files_status_check" check ("status" in ('Draft', 'Pending', 'Accepted', 'Returned'));`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `update "client_submissions" set "status" = 'Pending' where "status" = 'Draft';`,
    );
    this.addSql(
      `update "submission_files" set "status" = 'Pending' where "status" = 'Draft';`,
    );

    this.addSql(
      `alter table "client_submissions" drop constraint if exists "client_submissions_status_check";`,
    );
    this.addSql(
      `alter table "submission_files" drop constraint if exists "submission_files_status_check";`,
    );

    this.addSql(
      `alter table "client_submissions" alter column "status" type text using ("status"::text);`,
    );
    this.addSql(`alter table "client_submissions" alter column "status" set default 'Pending';`);
    this.addSql(
      `alter table "client_submissions" add constraint "client_submissions_status_check" check ("status" in ('Pending', 'Accepted', 'Returned'));`,
    );

    this.addSql(
      `alter table "submission_files" add constraint "submission_files_status_check" check ("status" in ('Pending', 'Accepted', 'Returned'));`,
    );
  }
}
