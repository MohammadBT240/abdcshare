# Built-in Help Center articles

Everything in this folder ships with the app. On every API start (and from **Admin → Help content →
Update built-in articles**, or `pnpm --filter @abdcshare/api help:sync`) the Markdown is converted to
the editor's format and installed. An article that someone has edited in the app is **never**
overwritten — the admin list marks it *Edited*, and **Restore default** brings back the shipped text.

## Layout

```
docs/help/
  <category>/_category.md      title, order, icon, description
  <category>/<slug>.md         one article; the file name is the address: /help/<slug>
  images/<category>/<name>.webp screenshots (generated — see below)
```

Category icons: `rocket briefcase checklist file users report books settings info book`.

## Article front matter

```yaml
---
title: Uploading to the Library          # required
summary: One sentence for the page header, cards and search results.
roles: [Platform Admin, Super Admin, Staff]   # who can read it; omit for everyone.
                                              # Also: Partner, PrincipalPartner (designations)
order: 2                                  # position within the category
related: [library-collections, library-access-and-licences]
---
```

## Writing

- `##` for sections (they make the "On this page" list), `###` for sub-sections. Don't use `#`.
- Numbered lists for steps. Name buttons and fields exactly as they appear, in **bold**.
- Callouts: `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]` (shown as *Important*).
- Links to other articles: `[text](help:slug)` or `[text](help:slug#section-id)`. Section ids are the
  heading text in lower case with dashes. Links to pages in the app: `[Library](/library)`.
- Tables, `code`, *italic* and **bold** work as usual. Raw HTML is dropped.
- **Only describe what the app actually does** — the screenshot tours (below) walk every flow the
  articles describe, so if a tour can't do it, the article shouldn't say it.

Check your work without a database: `pnpm --filter @abdcshare/api help:sync --check` (it also runs as
a unit test, so broken links, unknown roles or missing images fail CI).

## Screenshots

Screenshots are taken by Playwright tours in `e2e/help/*.tour.ts`, which create realistic demo data
through the real UI and API and save WebP images here. Re-run them when the UI changes:

1. Create an empty database and seed the demo people (test-only accounts, `@demo.test`):
   ```sh
   createdb abdcshare_demo
   export DATABASE_URL=postgresql://…/abdcshare_demo REDIS_URL=redis://localhost:6379/1
   pnpm --filter @abdcshare/api db:migrate && pnpm --filter @abdcshare/api seed:help-demo
   ```
2. Start the API and worker with that `DATABASE_URL`/`REDIS_URL` (and their own
   `LOCAL_STORAGE_DIR`, e.g. `./storage-demo`), plus the web app, ClamAV and LibreOffice as for e2e.
3. `cd e2e && npx playwright test -c playwright.help.config.ts`

Tours run in file-name order and later ones reuse earlier data, so always run them all against a fresh
database. Then commit the changed images and restart the API (or use *Update built-in articles*) to
upload them.
