import { Migration } from '@mikro-orm/migrations';

export class Migration20261112173707 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "library_items" drop constraint if exists "library_items_status_check";`);

    this.addSql(`alter table "library_events" drop constraint if exists "library_events_action_check";`);

    this.addSql(`alter table "library_items" add column "preview_error_code" text check ("preview_error_code" in ('password_protected', 'corrupt', 'timeout', 'unknown')) null, add column "scan_status" text check ("scan_status" in ('Pending', 'Clean', 'Infected', 'Error')) not null default 'Pending', add column "scanned_at" timestamptz null, add column "scan_attempts" int not null default 0, add column "scan_error" text null, add column "content_hash" char(64) null;`);
    this.addSql(`alter table "library_items" add constraint "library_items_status_check" check("status" in ('Draft', 'Published', 'Archived', 'Quarantined'));`);
    this.addSql(`create index "library_items_content_hash_idx" on "library_items" ("content_hash");`);

    this.addSql(`alter table "library_events" add constraint "library_events_action_check" check("action" in ('Viewed', 'Downloaded', 'Uploaded', 'FileReplaced', 'Edited', 'VisibilityChanged', 'Archived', 'Restored', 'Deleted', 'Reported', 'ReportResolved', 'OwnershipTransferred', 'AddedToCollection', 'RemovedFromCollection', 'ZipExported', 'Quarantined'));`);

    // S3 D24: scan every file already in the library (they start Pending, so downloads wait for Clean).
    this.addSql(`insert into "outbox" ("id", "created_at", "updated_at", "event_type", "payload", "status")
      select gen_random_uuid(), now(), now(), 'library.scan_requested',
        jsonb_build_object('itemId', "id", 'storageKey', "storage_key"),
        'Pending'
      from "library_items" where "storage_key" is not null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "library_events" drop constraint if exists "library_events_action_check";`);

    this.addSql(`alter table "library_items" drop constraint if exists "library_items_status_check";`);

    this.addSql(`alter table "library_events" add constraint "library_events_action_check" check("action" in ('Viewed', 'Downloaded', 'Uploaded', 'FileReplaced', 'Edited', 'VisibilityChanged', 'Archived', 'Restored', 'Deleted', 'Reported', 'ReportResolved', 'OwnershipTransferred', 'AddedToCollection', 'RemovedFromCollection', 'ZipExported'));`);

    this.addSql(`drop index "library_items_content_hash_idx";`);
    this.addSql(`alter table "library_items" drop column "preview_error_code", drop column "scan_status", drop column "scanned_at", drop column "scan_attempts", drop column "scan_error", drop column "content_hash";`);

    this.addSql(`alter table "library_items" add constraint "library_items_status_check" check("status" in ('Draft', 'Published', 'Archived'));`);
  }

}
