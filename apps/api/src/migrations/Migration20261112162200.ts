import { Migration } from '@mikro-orm/migrations';

/**
 * Company Profiles: in-house Office → PDF previews (worker LibreOffice) replace the Office Online
 * embed, which handed presigned object URLs to a third party. Existing Office profiles are queued
 * for conversion via the outbox so their previews appear without a re-upload.
 */
export class Migration20261112162200 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "company_profiles" add column "preview_storage_key" varchar(255) null, add column "preview_status" text check ("preview_status" in ('None', 'Pending', 'Ready', 'Failed')) not null default 'None', add column "preview_error" text null;`);

    const office = `(lower(file_name) ~ '\\.(docx?|xlsx?|pptx?)$')`;
    this.addSql(
      `update "company_profiles" set "preview_status" = 'Pending' where "is_active" and "storage_key" is not null and ${office};`,
    );
    this.addSql(`insert into "outbox" ("id", "created_at", "updated_at", "event_type", "payload", "status")
      select gen_random_uuid(), now(), now(), 'file.preview_requested',
        jsonb_build_object('entityType', 'company_profile', 'fileId', "id", 'storageKey', "storage_key",
                           'fileName', "file_name", 'mimeType', "mime_type"),
        'Pending'
      from "company_profiles" where "preview_status" = 'Pending';`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "company_profiles" drop column "preview_storage_key", drop column "preview_status", drop column "preview_error";`);
  }

}
