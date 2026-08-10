# Request expected documents + expectation brief

**Date:** 2026-08-04  
**Status:** Approved — implemented  

## Problem

Request list/workspace progress is a phase/status heuristic and does not reflect how many client documents are actually needed or accepted. Staff also have no structured way to attach a client-visible instruction file when raising a request.

## Goals

1. Capture an **expected document count** per request at create time (editable later by staff).
2. Use that count to drive request **progress** more accurately.
3. Allow an **optional expectation brief** file at create time; if present, clients can download it on the request overview; staff can replace or remove it later.

## Non-goals

- Changing catalogue `requestType.expectedDocuments` semantics beyond using it as a default.
- Multi-file briefs or version history.
- Blocking client finalize when accepted/uploaded count ≠ expected (soft progress only).
- Using working papers / engagement Supporting docs as the brief.

## Decisions (locked)

| Topic | Choice |
|---|---|
| Progress formula | `acceptedCurrentFiles / expectedDocumentCount`, capped at 100%; **force 100%** when request status is Complete/Closed/Done |
| Expected count source | Persisted on the **request**; prefilled from `requestType.expectedDocuments` when type is selected |
| Brief storage | Approach 1: columns (or 1:1 fields) on the request + request upload APIs; not `DocumentCategory` |
| Brief lifecycle | Single file; staff may **replace or remove** after create |
| Visibility | Anyone with `request:view` can see/download the brief; create/replace/remove requires `request:update` (same as other request edits) |

## Data model

### `requests` table (new columns)

| Column | Type | Notes |
|---|---|---|
| `expected_document_count` | `int` | Required ≥ 1; default from type or `1` |
| `brief_storage_key` | `varchar` nullable | Object storage key |
| `brief_file_name` | `varchar` nullable | Original filename |
| `brief_content_type` | `varchar` nullable | MIME |
| `brief_size_bytes` | `bigint` nullable | Size |
| `brief_uploaded_at` | `timestamptz` nullable | Set on confirm |

Migration via MikroORM. Existing rows: set `expected_document_count = 1` (or join request type’s `expectedDocuments` in migration if cheap).

### DTOs

**Create / update request**

- `expectedDocumentCount?: number` (create: default from type if omitted; validate `Min(1)`, sensible `Max` e.g. 500)
- Brief is **not** a multipart body on create JSON; upload after create (or create then immediately presign) — see API flow

**Request response (list + detail)**

- `expectedDocumentCount: number`
- `acceptedFileCount?: number` (list/detail enrichment; current non-superseded Accepted submission files)
- `progressPercent: number` (server-computed with formula below)
- `brief?: { fileName, contentType, sizeBytes, uploadedAt } | null` (no storage key to clients)

## Progress computation

Shared helpers live in `@abdcshare/shared` (`request-metrics`).

**Done statuses:** `Accepted`, `Closed`, plus case-insensitive aliases containing `complete` / `done`.

```
function requestProgressPercent(request):
  expected = max(1, request.expectedDocumentCount)
  accepted = count current (non-superseded) submission files with status Accepted
  return min(100, round(accepted / expected * 100))
```

- Request `%` is file-delivery only — Accepted/Closed status does **not** force 100%.
- **Accepted** (file) uses existing `SubmissionStatus.Accepted` on `submission_files`.
- Draft submissions ignored; superseded/replaced files ignored (same rules as submission metric cards).
- Web lists/work-tab use API `progressPercent` / `isOverdue`.
- **Engagement / class `%`:** status completion via `statusProgressPercent` — equal weight per request; Accepted/Closed/… count as done regardless of document delivery. Empty engagements/classes → 0%. Class `done/total` matches this status basis.
- **Overdue:** not done, has due date, and due date is before start of today (due today is not overdue).

## API

### Create request (unchanged shape + count)

`POST /api/requests`

- Accept `expectedDocumentCount?`
- If omitted: `requestType.expectedDocuments` (fallback `1`)
- Persist on entity

### Brief upload (after request exists)

Mirror document/submission presign pattern:

1. `POST /api/requests/:id/brief/presign` `{ fileName, contentType, sizeBytes }` → `{ uploadUrl, storageKey }`  
   - Auth: `request:update` + request scope  
   - Reject if replacing without delete? Prefer: presign always allowed; confirm overwrites previous key (delete old object best-effort)
2. Client `PUT` to storage
3. `POST /api/requests/:id/brief/confirm` `{ storageKey, fileName, contentType, sizeBytes }`  
   - Validates key prefix ownership; updates request brief columns; clears previous key

### Brief download

`POST /api/requests/:id/brief/download` (or GET) → `{ downloadUrl }`  
- Auth: `request:view` + scope  
- 404 if no brief

### Brief remove

`DELETE /api/requests/:id/brief`  
- Auth: `request:update`  
- Clears columns; best-effort delete storage object

### Patch request

`PATCH /api/requests/:id` may update `expectedDocumentCount` (staff with update permission).

### List enrichment

Batch count accepted files per request id (same pattern as engagement `batchListCounts`) so list payloads include `progressPercent` / `acceptedFileCount` without N+1.

## UI

### Create request dialog

- Number field **Expected documents** (required, ≥ 1), prefilled when request type changes from `expectedDocuments` on the type row (catalogue already returns it).
- Optional **Expectation brief** file input (single file; reuse `FileUpload` / validation constants for docs).
- Submit flow:
  1. `POST /requests` with count (+ other fields)
  2. If file selected: presign → upload → confirm
  3. On brief failure after create: toast error; request still exists; user can upload from overview

### Request overview (all roles with view)

- Card near description / above “Client documents”:
  - “Expectation brief” with filename + Download
  - If none: muted “No brief attached”
- Staff (`request:update`): Replace / Remove actions
- Show expected vs accepted in metrics area (e.g. “Accepted 2 of 5 expected”) using existing metric cards or a small line beside progress

### Edit request dialog

- Allow changing expected document count

### Lists / work tab

- `CircularProgress` binds to `progressPercent` from API
- Optional subtitle `acceptedFileCount/expectedDocumentCount` only if space allows (not required)

## Permissions

| Action | Permission |
|---|---|
| Read count + progress | `request:view` |
| Download brief | `request:view` |
| Set count on create/update | `request:create` / `request:update` |
| Upload/replace/remove brief | `request:update` |

Clients: view + download only.

## Testing

- Unit: progress helper (done status, 0 accepted, partial, over-accepted → 100)
- Service: create defaults count from type; brief confirm overwrites; download 404 without brief
- Web: create dialog prefills count on type change; overview shows download for client role (permission-gated tests if present)

## Rollout

1. Migration + entity/DTO  
2. Progress enrichment on list/detail  
3. Brief APIs  
4. Create dialog + overview UI  
5. Swap list/work-tab heuristics to API percent  

## Open points (resolved)

- Max expected count: **500**  
- Over-accepted files: progress **caps at 100%**, does not block  
- Brief file types: same document attachment allow-list as existing uploads (`ATTACHMENT_ACCEPT` / size caps)
