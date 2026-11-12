import { Migration } from '@mikro-orm/migrations';

type Node = Record<string, unknown>;
const text = (t: string, bold = false): Node => ({ type: 'text', text: t, ...(bold ? { marks: [{ type: 'bold' }] } : {}) });
const p = (...parts: (string | Node)[]): Node => ({
  type: 'paragraph',
  content: parts.map((x) => (typeof x === 'string' ? text(x) : x)),
});
const h = (t: string): Node => ({ type: 'heading', attrs: { level: 2 }, content: [text(t)] });
const ul = (...items: (string | Node[])[]): Node => ({
  type: 'bulletList',
  content: items.map((i) => ({
    type: 'listItem',
    content: [typeof i === 'string' ? p(i) : { type: 'paragraph', content: i }],
  })),
});

/** Help Center article "Using the Library" (S3 launch). Idempotent: skipped if the slug exists. */
const BODY: Node = {
  type: 'doc',
  content: [
    p(
      'The Library is the firm’s shared shelf for reports, research papers, training materials and templates. ',
      'Anything you upload is visible straight away to the people you choose.',
    ),
    h('Finding things'),
    ul(
      'Search looks at titles, descriptions, authors, tags and file names — not the text inside files.',
      'Filter by category, year, file type or department; click a tag to see everything with it.',
      'Open an item to read it in the browser — PDFs, Word, Excel and PowerPoint files, images and text. You don’t need to download it.',
      'Collections group the material from one training, workshop, conference or project. Use “Download all” for a ZIP.',
    ),
    h('Uploading'),
    ul(
      [text('Upload → One file', true), text(' or '), text('Several files', true), text('. Give each a clear title and a category.')],
      'Confirm the declaration: the file contains no client-identifiable information, or you have restricted it to the right departments. If you are unsure, anonymise it first or ask a library curator.',
      [text('Who can see it: ', true), text('everyone in the firm, or only specific departments (plus you and the curators).')],
      [text('Licence: ', true), text('internal use only (the default), licensed material (do not share outside the firm) or free to share.')],
      [text('View-only: ', true), text('staff can read it but not download it. It discourages copying; it can’t prevent screenshots.')],
      'Every file is checked for viruses. You can read it straight away; downloads open once the check has passed — usually within seconds.',
      'If the same file is already in the library, you’ll be told before uploading.',
    ),
    h('Looking after your uploads'),
    ul(
      'You can edit the details, replace the file (you’ll confirm the declaration again), archive or restore anything you uploaded. Find it under My uploads.',
      'The Activity tab shows who opened and downloaded your item — every view is recorded.',
      'Library curators (Super Admins) can edit, archive or delete any item and transfer it to a new owner.',
    ),
    h('Reporting a problem'),
    p(
      'If an item names a client, breaks a licence, is out of date or doesn’t belong, open it and choose ',
      text('More actions → Report a problem', true),
      '. It stays visible until a curator decides; you’ll get a notification when they have.',
    ),
  ],
};

const BODY_TEXT =
  'The Library is the firm’s shared shelf for reports, research papers, training materials and templates. ' +
  'Finding things: search titles, descriptions, authors, tags and file names; filter by category, year, file type or department; ' +
  'open items in the browser; collections group training and project material, download all as a ZIP. ' +
  'Uploading: one file or several files; confirm the declaration about client-identifiable information; choose who can see it; ' +
  'licence: internal use only, licensed, free to share; view-only; virus check before download; duplicate warning. ' +
  'Looking after your uploads: edit, replace, archive, restore; activity tab; curators can transfer ownership. ' +
  'Reporting a problem: More actions, Report a problem; curators review reports.';

/** Dollar-quoted literal (addSql takes no bind parameters). */
function dollar(value: string): string {
  if (value.includes('$help$')) throw new Error('Unexpected delimiter in help content');
  return `$help$${value}$help$`;
}

export class Migration20261112190000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`insert into "help_categories" ("id", "name", "slug", "order", "icon")
      select gen_random_uuid(), 'Library', 'library', 50, 'library'
      where not exists (select 1 from "help_categories" where "slug" = 'library');`);
    this.addSql(
      `insert into "help_articles" ("id", "category_id", "title", "slug", "body_json", "body_text", "visible_to_roles", "status", "order", "updated_at", "published_at")
       select gen_random_uuid(), c."id", 'Using the Library', 'using-the-library', ${dollar(JSON.stringify(BODY))}::jsonb, ${dollar(BODY_TEXT)}, '["Staff","Super Admin","Platform Admin"]'::jsonb, 'published', 0, now(), now()
         from "help_categories" c
        where c."slug" = 'library' and not exists (select 1 from "help_articles" where "slug" = 'using-the-library');`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`delete from "help_articles" where "slug" = 'using-the-library';`);
  }
}
