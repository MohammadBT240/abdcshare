import { Migration } from '@mikro-orm/migrations';

/** Per-request expected document count + optional client-visible expectation brief. */
export class Migration20260804193000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "requests" add column "expected_document_count" int not null default 1;`,
    );
    this.addSql(
      `alter table "requests" add column "brief_storage_key" varchar(255) null;`,
    );
    this.addSql(
      `alter table "requests" add column "brief_file_name" varchar(255) null;`,
    );
    this.addSql(
      `alter table "requests" add column "brief_content_type" varchar(255) null;`,
    );
    this.addSql(
      `alter table "requests" add column "brief_size_bytes" bigint null;`,
    );
    this.addSql(
      `alter table "requests" add column "brief_uploaded_at" timestamptz null;`,
    );
    // Prefill from catalogue when available.
    this.addSql(`
      update "requests" r
      set "expected_document_count" = greatest(1, coalesce(rt."expected_documents", 1))
      from "request_types" rt
      where r."request_type_id" = rt."id";
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "requests" drop column "brief_uploaded_at";`);
    this.addSql(`alter table "requests" drop column "brief_size_bytes";`);
    this.addSql(`alter table "requests" drop column "brief_content_type";`);
    this.addSql(`alter table "requests" drop column "brief_file_name";`);
    this.addSql(`alter table "requests" drop column "brief_storage_key";`);
    this.addSql(`alter table "requests" drop column "expected_document_count";`);
  }
}
