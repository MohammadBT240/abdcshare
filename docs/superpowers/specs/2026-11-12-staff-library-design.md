# Staff Knowledge Library — design

_Status: approved 12 Nov 2026 · L1 (API + worker) built on `feature/staff-library` · L2 (web) and L3 (polish) pending_

## 1. Goal
A firm-wide knowledge base where any internal user can upload reports, research papers, training material, templates and similar files. Other staff find them by browsing or searching metadata and read them **in the browser without downloading**.

## 2. Decisions (12 Nov 2026)
| # | Decision |
|---|---|
| D1 | New `library` module, **separate** from Company Profiles. |
| D2 | **Publish instantly.** Uploaders edit, replace and archive their own items; curators edit, archive, restore and delete anything. |
| D3 | **Metadata search only** (title, description, authors, tags, source, file name). No text extraction from file contents. |
| D4 | **In-browser viewing.** PDF, images, TXT and CSV render natively; Office files are converted to PDF **in-house** by the worker's LibreOffice step. Download stays available. |
| D5 | **Internal users only** (Platform Admin, Super Admin, Staff). An item is **Firm-wide** (default) or **restricted to chosen departments**. Clients and Guests never see the library. |
| D6 | Defaults accepted: curators (SA/PA) see restricted items; one file per item; no link-only items; no version history on replace (audit log records it); uploaders archive but cannot hard-delete; no new-item notifications in v1. |

## 3. Permissions (`packages/shared/src/permissions.ts`)
| Permission | Roles | Meaning |
|---|---|---|
| `library:view` | PA, SA, Staff | Browse, search, view within visibility scope |
| `library:contribute` | PA, SA, Staff | Upload; edit, replace, archive **own** items |
| `library:curate` | PA, SA | Edit, archive, restore, delete **any** item; see department-restricted items |
| `catalogue:manage` (existing) | PA | Manage library categories |

Staff curators wait for the configurable-roles work.

## 4. Data model — `Migration20261112120000`
- **`library_categories`** — `name` (unique), `slug` (unique), `description`, `sort_order`, `is_active`. Seeded: Reports, Research Papers, Training Materials, Templates & Tools, Policies & Methodology, Regulatory & Standards.
- **`library_items`** — title (≤300), description, `category_id`, authors (free text), `published_year`, source, `tags text[]` (lower-cased, de-duplicated, ≤20 × ≤40 chars), `visibility` (Firm/Departments), `status` (Draft/Published/Archived), file columns, preview columns (same names as `submission_files`/`document_files`), `uploaded_by_id`, `published_at`, `archived_by_id`, `archived_at`, `view_count`, `download_count`, timestamps.
- **`search_vector`** — `tsvector generated always as (...) stored`, `english` config: title **A**; tags + authors **B**; description + source + file name **C**. GIN indexed. `library_tags_text(text[])` is an IMMUTABLE wrapper over `array_to_string` (which is only STABLE and not allowed in a generated column). Mapped on the entity with `generated` + `lazy` so MikroORM never writes it and the schema generator produces the same DDL (verified: `getCreateSchemaSQL()` matches the migration).
- **`library_item_departments`** — `(item_id, department_id)` pivot, cascade on delete.
- Indexes: GIN on `tags` and `search_vector`; `(status, category_id, published_at, id)`; `uploaded_by_id`; `published_year`.

## 5. Visibility (`library-access.ts`)
- `canSeeItem` (get / preview / download) and `libraryScopeSql` (lists, counts, tags) encode one rule:
  curator → everything; uploader → own items in any state; others → **Published** and (**Firm** or **one of the item's departments is theirs**).
- Users with no department see Firm items and their own uploads only.
- Lists never include Drafts. Non-curators list Archived items only under `mine=true`.
- Hidden items return **404**, not 403, so restricted items don't leak.
- `AuthenticatedUser` has no department; `LibraryService.viewer()` loads it once per request.

## 6. Upload and viewing
1. `POST /library/items` → **Draft** with metadata.
2. Uppy upload: `…/files/presign` (<50 MB) or `…/files/multipart*` (>50 MB). Keys live under `library/<itemId>/`; any other key is rejected.
3. `POST /library/items/:id/files` confirms: HEAD-measured size ≤100 MB, MIME **and** extension allow-listed (PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, PNG/JPG, TXT, CSV), Draft → Published. Office files get a `file.preview_requested` outbox row (`entityType: 'library_item'`) **in the same flush**. On replace, the old object and old preview are deleted after commit (new `StoragePort.delete`).
4. Worker `FilePreviewService` maps `library_item → library_items`. For library rows it only writes the preview if `storage_key` still matches the job's file, so a stale job can't overwrite a newer file's preview.
5. `GET /library/items/:id/preview` → `{ mode: 'native' | 'converted' | 'unavailable', url, previewStatus, reason? }` (same shape as engagement documents, so the web viewer is reusable). `reason` is `pending | failed | unsupported`. `?retry=true` re-queues a Failed conversion for editors.
6. Views and downloads are counted with atomic `+ 1` updates (pending previews don't count).
7. Hourly sweep deletes Drafts older than 24 h.

Limits: wide spreadsheets convert poorly (UI should suggest download for XLS/XLSX). In-browser viewing prevents casual downloading, not copying.

**Not used:** Company Profiles' Microsoft Office Online embed, which hands a working presigned URL to a third party. Company Profiles should move to the LibreOffice path (L3).

## 7. API (`/api/library`; `library` added to the BFF proxy allow-list)
| Route | Permission | Notes |
|---|---|---|
| `GET items` | view | `q`, `categoryId`, `departmentId`, `tag`, `year`, `fileType` (pdf/word/excel/powerpoint/image/text), `mine`, `status` (Published/Archived), `sort` (relevance/newest/title/views/downloads; default relevance when `q`, else newest) |
| `GET items/:id` | view | |
| `POST items` | contribute | Draft |
| `PATCH items/:id` | contribute (own) / curate | Metadata, category, visibility, departments |
| `POST items/:id/files[/presign\|/multipart…]` | contribute (own) / curate | Upload / replace |
| `POST items/:id/archive`, `/restore` | contribute (own) / curate | |
| `DELETE items/:id` | curate | Archived (or Draft) only; removes objects |
| `GET items/:id/preview`, `/download` | view | |
| `GET tags?q=` | view | Distinct tags on visible Published items, most used first |
| `GET categories` | view | `includeInactive` honoured for `catalogue:manage` |
| `POST categories`, `PATCH categories/:id`, `POST categories/:id/(de)activate` | catalogue:manage | |

Search: `search_vector @@ websearch_to_tsquery('english', q) OR title ILIKE %q%`, ranked by `ts_rank`. Every list is paginated with an `id` tiebreaker.

## 8. Web (L2)
- Sidebar "Library" under Work (`library:view`).
- `/library`: search, category rail, filters (department, year, type, tags, My uploads), card/table views, URL state.
- Upload dialog: Uppy dropzone with retry; title from file name; category, description, authors, year, source, tags (creatable combobox), visibility + departments.
- `/library/[id]`: embedded viewer (reuse the documents preview component), "Preparing preview…" polling, download fallback; side panel with metadata and Edit / Replace / Archive / Restore.
- `/admin/catalogues/library-categories`.
- Regenerate `packages/api-client` from the live API.

## 9. L3
Global search integration, "most viewed", empty/error/a11y states, Help article + `HelpTip`, docs (USER_STORIES epic, ERD, TRACEABILITY), Company Profiles off the Microsoft viewer.
