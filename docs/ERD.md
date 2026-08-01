# abdcshare — Entity Relationship Diagram (ERD) · v3 (full parity)

> The relational schema for abdcshare, **rebuilt to full field-level parity** with the legacy ACA system
> (see `LEGACY_AUDIT.md` — 66 tables / 351 columns), re-represented in the better model (engagements +
> request classes, unified documents, RBAC). Target DB: **PostgreSQL** via **MikroORM**.
>
> **Principle:** parity of *capability and data*, not a port of legacy structure. We keep every functional
> field; we drop legacy technical debt (string `record_id`/`update_record_id`, `created_by` as varchar,
> duplicated `updated_at` as varchar) in favour of real FKs, uuid PKs, and `timestamptz`.

---

## 0. Decisions applied (confirmed)

1. **Reference data:** keep the **core** `global_*` lookups; **HR-ish** ones flagged _⚠ confirm/drop_.
2. **RBAC:** role-based (via `@abdcshare/shared` permission map). Legacy `users_access` (per-user grants)
   is **dropped** — not carried.
3. **Documents:** the ~30 per-service-line working-paper / final-report / files / auditor-staff-advisor
   tables are **unified** into `documents` + `document_files` + `document_participants`.
4. **Final report upload:** **Super Admin only** (permission `final-report:upload`), distinct from
   `working-paper:upload` (Staff / Super Admin).

---

## 1. Conventions

- PK = primary key, FK = foreign key, UQ = unique. Surrogate PKs are `uuid` (domain rows) or `int`
  (small lookups). Human codes (e.g. `reference_code`) are separate UQ business keys.
- All tables carry `created_at timestamptz`; mutable tables add `updated_at timestamptz`. `created_by`
  is a real FK → `users.id` (was a varchar in legacy).
- **Enums** (fixed, attribute-less domains) are DB enums; **lookups** (have their own attributes / are
  user-managed) are tables.

---

## 2. Reference data (`lookups`)  — legacy `global_*`

**Kept (core, user-manageable):** each is `{ id int PK, name varchar UQ, is_active bool }` unless noted.

| Table | From legacy | Notes |
|-------|-------------|-------|
| `titles` | global_title | Mr, Mrs, Dr… |
| `genders` | global_gender | |
| `marital_statuses` | global_marital_status | |
| `client_types` | global_client_type | Individual / Corporate… (drives client fields) |
| `industries` | global_industry | |
| `categories` | global_category | |
| `banks` | global_banks | |
| `states` | global_state | |
| `lgas` | global_lga | `state_id` FK |
| `wards` | global_ward | `lga_id` FK |
| `request_statuses` | global_request_status | + `sort_order` |
| `general_statuses` | global_status | generic active/inactive style status |

**Flagged _⚠ confirm/drop_ (look like HR/onboarding leftovers, not audit-portal core):**
`positions`, `field_studied`, `global_courses`, `global_pension`. Kept out of the base schema pending
your confirm; trivial to add back as `{id,name,is_active}` lookups if needed.

---

## 3. Identity & access

**users**  *(legacy `users_details`, 24 cols — full profile preserved; staff + client-contact people)*
| Column | Type | Key / note |
|--------|------|------------|
| id | uuid | PK |
| role_id | int | FK → roles.id |
| partner_designation | enum(PrincipalPartner, Partner) | null — Super-Admin-only sub-flag; **at most one `PrincipalPartner`** (partial unique index), see §6a |
| department_id | int | FK → departments.id, null |
| client_id | uuid | FK → clients.id, null (set for client-contact users) |
| title_id | int | FK → titles.id, null |
| first_name / middle_name / surname | varchar | (legacy split names; `full_name` is derived) |
| gender_id | int | FK → genders.id, null |
| marital_status_id | int | FK → marital_statuses.id, null |
| email | varchar | UQ |
| phone_number | varchar | null |
| official_address / residential_address | varchar | null |
| avatar_path | varchar | null |
| password_hash | varchar | (bcryptjs) |
| must_change_password | bool | |
| is_active | bool | |
| created_by | uuid | FK → users.id, null |

**roles** `{ id int PK, role_name varchar UQ }` (legacy `users_roles`).
**refresh_tokens** — JWT rotation (id, user_id FK, token_hash UQ, family_id, user_agent, ip_address, expires_at, revoked_at).
**password_reset_tokens** — (id, user_id FK, token_hash UQ, expires_at, used_at).
> **Dropped:** `users_access` (per-user grants) → replaced by role→permission RBAC.
>
> **Roles (v8):** `Platform Admin`, `Super Admin`, `Staff`, `Client`, **`Guest`** (invited by the Principal
> Partner solely to submit a report; forced password change on first login). **`Auditor` is no longer a role** —
> every Staff is a working practitioner; "Auditor" survives as the per-engagement **team member_role**
> tag (Partner/Manager/Auditor). **Engagements are created by Super Admin only**; staff work inside the
> engagements they're attached to. **Row-level scope:** Client → own client's rows; Staff → engagements
> they're on the team of (+ their requests); Platform/Super Admin → unrestricted (see `common/security/
> access-scope.ts`).

---

## 4. Clients  *(legacy client data lived in `users_details` with company fields)*

**clients** — the organisation being audited
| id uuid PK · name varchar UQ · client_type_id FK → client_types, null ·
| company_name varchar · company_registered_address varchar · incorporation_date date, null ·
| incorporation_no varchar, null · official_address / residential_address varchar, null ·
| email / phone_number varchar, null ·
| primary_contact_id uuid FK → users.id, null, UQ · is_active bool · created_by FK |

> **Trimmed (v4):** industry / category / bank / state / lga / ward are **no longer captured on the
> client**. Those lookup tables remain available as reference data but the client no longer FKs them.

Client **contact people** are `users` with `role = Client` and `client_id` set (§3). Every client has a
**primary contact** (`clients.primary_contact_id`) — the person whose credentials log in for that client.
Creating a client **provisions this contact atomically**: a `Client`-role user is created with a temp
password, `must_change_password = true`, and a `user.created` outbox event that emails the credentials.

---

## 5. Departments  *(formerly "service lines")*
`departments { id int PK, name varchar UQ, is_active bool }` — Assurance, Tax, Advisory, Business
Development, Shared Services, Other.

---

## 6. Engagements

**engagements** — top-level container for a client's work
| id uuid PK · client_id FK · engagement_type_id FK · department_id FK · reference_code varchar UQ ·
| title · period_label varchar null · **status enum(Planning,Execution,Reporting,Completed,Archived)** ·
| start_date / target_completion_date date null · completed_at timestamptz null · created_by FK |

> **Stages (v7):** the working lifecycle is **Planning → Execution → Reporting → Completed → Archived**
> (Fieldwork→Execution, Review→Reporting rename). Requests and documents carry a `phase`
> (Planning/Execution/Reporting) for the stage they belong to — e.g. **planning preliminaries** are
> requests/documents with `phase = Planning`. **`Supporting`** documents are engagement-level reference
> material (no request class), uploadable by any team member.

- **engagement_types** `{ id int PK, name UQ, is_active }`.
- **request_classes** `{ id int PK, code UQ null, name UQ, description text null, is_active }`.
- **request_class_engagement_types** — composite PK (request_class_id, engagement_type_id): allowed request classes per type.
- **engagement_team_members** — PK (engagement_id, user_id): member_role enum(Partner,Manager,Auditor), assigned_by FK, assigned_at.
- **engagement_request_classes** — PK (engagement_id, request_class_id): sort_order, added_by FK.
- **engagement_status_history** — id, engagement_id FK, from_status, to_status, changed_by FK, changed_at, note.
- **engagement_sign_offs** — id, engagement_id FK, request_class_id FK null, signed_by FK, signed_at, note, revoked_by FK null, revoked_at, revoke_reason.

---

## 6a. Partner designations & weekly partner reports  *(NEW — beyond legacy)*

Super Admins can carry a **partner designation** (`users.partner_designation`, §3): **`Partner`** or
**`PrincipalPartner`**. Rules:
- Only applicable to `role = Super Admin` (enforced in the service).
- **Exactly one `PrincipalPartner`** at a time — enforced by a partial unique index
  (`UNIQUE (partner_designation) WHERE partner_designation = 'PrincipalPartner'`) **and** a service guard.
- `Partner` may be held by many Super Admins; a Super Admin may also have **no** designation.

**Reporting flow (v8 — structured):** **Partners** (and invited **Guests**) submit periodic structured
reports to the **Chairman** (Principal Partner), who reviews. Modelled on the chairman-reporting-portal
(sections: reporting officer · executive summary · financials · client/engagement updates · people &
capacity · matters requiring decision · outlook. Risk/Compliance/QA and Strategic Initiatives are
intentionally excluded).

**partner_reports** — id uuid PK · submitted_by FK → users · invite_id FK → partner_report_invites null
(set for Guest reports) · reporting_officer_name · officer_title enum(Partner,Director,HeadOfDepartment,
ManagingConsultant) · department · period_type enum(Weekly,Monthly,Quarterly,AdHoc) · period_label null ·
executive_summary text null · currency enum(NGN,USD) null · fee_revenue/billings_raised/collections_received/
outstanding_wip numeric(18,2) null · variance_vs_budget varchar null · people_capacity text null ·
outlook text null · status enum(Draft,Submitted,Reviewed) · submitted_at null · reviewed_by FK null ·
review_notes null · reviewed_at null.

**partner_report_engagement_updates** *(04)* — id, report_id FK, client_engagement, update text,
status enum(OnTrack,Watch,AtRisk,NewWin), sort_order.
**partner_report_decisions** *(08)* — id, report_id FK, decision text,
priority enum(Urgent,ThisPeriod,ForInformation), sort_order.

**partner_report_invites** *(Guest access)* — id uuid · invited_by FK → users (the Principal Partner) ·
guest_user FK → users (the provisioned `Guest`) · email · status enum(Invited,Submitted,Revoked).
The Principal Partner invites by email → a **`Guest`-role user** is provisioned (temp password +
`must_change_password`, credentials + login link emailed) → the guest logs in, changes password, and
submits one report to the Chairman.

**Automation / permissions:** submit → notifies the Chairman; review → notifies the author.
`partner-report:submit` (Partner desig + Guest role), `partner-report:view` (authors see own / Chairman
sees all), `partner-report:review` + `partner-report:view-all` + `partner-report:invite` (Principal
Partner). **`mustChangePassword` is globally enforced** (MustChangePasswordGuard) so an invited guest must
set a password before doing anything.

---

## 7. Requests & client submissions

**requests** *(legacy `request_client`)*
| id uuid PK · engagement_id FK · request_type_id FK (→ request_class derived) · stage_id FK → request_stages ·
| status_id FK → request_statuses · **phase enum(Planning,Execution,Reporting) null** (the engagement
| stage this request belongs to; defaults to the engagement's current stage) · description text ·
| due_date date null · created_by FK |

- **request_types** *(legacy `request_type`)* `{ id int PK, request_class_id FK, name, expected_documents int (legacy documents_no), is_active }` — **grouped under request class** (UQ on request_class_id+name).
- **request_stages** `{ id int PK, name, sort_order, is_active }`.
- **request_assignees** *(legacy `assigned_auditors`)* — PK (request_id, user_id), assigned_by FK, assigned_at.
- **request_history** *(legacy `requesthistory`)* — id, request_id FK, actor_id FK, event_type, module varchar, from_value/to_value null, note null, created_at.
- **client_submissions** *(legacy `client_response`)* — id, request_id FK, submitted_by FK, message text, status enum(Pending,Accepted,Returned), reviewed_by FK null, review_reason null, reviewed_at null.
- **submission_files** *(legacy `client_response_sub`)* — id, submission_id FK, storage_key, file_name, mime_type, size_bytes, status enum(Pending,Accepted,Returned), uploaded_at.

---

## 8. Documents (UNIFIED — replaces ~30 legacy tables)

Legacy had, per service line: `*_working_paper`(+`_files`) and `*_final_reports`(+`_files`,`_auditors`/
`_advisors`/`_staffs`). Unified:

**documents** — the logical paper/report
| id uuid PK · engagement_id FK · **request_class_id FK null** (null for Supporting) · request_id FK null ·
| department_id FK · **phase enum(Planning,Execution,Reporting) null** ·
| **category enum(WorkingPaper, FinalReport, Supporting)** · title (legacy paper_title/report_title) ·
| description text (legacy *_description) · status enum(Draft, Ready, UnderReview, SignedOff) ·
| current_version int · **client_review_state enum(NotSent, AwaitingClient, ChangesRequested, Locked,
| Approved, Overridden)** · **client_review_round int** (final-report client review; NotSent/0 for working
| papers) · created_by FK |

**document_files** *(legacy `*_working_paper_files` / `*_final_report_files`)* — files, many per document, **versioned**
| id uuid PK · document_id FK · version int · storage_key · file_name · mime_type · size_bytes ·
| uploaded_by FK · uploaded_at |

**document_participants** *(legacy `*_auditors` / `*_advisors` / `*_staffs`)* — people attached
| PK (document_id, user_id) · participant_role enum(Auditor, Advisor, Staff) · added_by FK · added_at |

**report_review_cycles** *(🆕 final-report client review loop)* — one row per round
| id uuid PK · document_id FK (cascade) · round_no int (1–3) · file_version int (version the client saw) ·
| sent_by FK · sent_at · decision enum(Pending, Approved, ChangesRequested) · decided_by FK null ·
| decided_at null · feedback text null |

**Upload rule:** `WorkingPaper` → `working-paper:upload` (Staff / Super Admin); `FinalReport` →
`final-report:upload` (**Super Admin only**). Upload = presigned direct-to-R2 → confirm → outbox →
worker post-processing (see ARCHITECTURE §8, §12). Bulk upload & zip **export** via the worker.

**Final-report client review (🆕):** after compiling a final report, the SA **sends the draft to the
client** (`report-review:manage`). The client (`report-review:respond`, row-scoped to its own engagement)
**views/downloads** it and **approves** or **requests changes** with feedback. Each send is a cycle
(`report_review_cycles`); **max 3 cycles**. **Client approval finalises/issues** the report
(`documents.status → SignedOff`). If the client requests changes on the 3rd cycle it **locks**
(`client_review_state = Locked`) and only an SA **override** (`report-review:manage`) can finalise it.
Both sides are notified on each transition.

---

## 9. Reviews  *(legacy `reviews`)*
**reviews** — id, request_id FK null, document_id FK null, preparer_id FK, reviewer_id FK null,
status enum(ForReview, Approved, SentBack), notes text (legacy description), sent_from FK null,
submitted_at, decided_at null.

---

## 10. Discussions (enhanced; legacy discussion + read-tracking)
- **discussion_messages** — id, request_id FK, author_id FK, parent_message_id FK null, body, edited_at null.
- **discussion_reads** — PK (request_id, user_id), last_read_message_id FK null, updated_at.
- **discussion_attachments** — id, message_id FK, storage_key, file_name, mime_type, size_bytes.
- **discussion_mentions** — PK (message_id, mentioned_user_id).

---

## 11. Notifications  *(legacy `notifications`, `notification_preferences` — full fields)*
**notifications** — id, user_id FK, type varchar, title, body text (legacy message), entity_type
(legacy related_type), entity_id (legacy related_id), link null, is_read bool, read_at null,
email_sent bool, email_sent_at null, created_at.
**notification_preferences** — PK (user_id, notification_type): email_enabled bool, **in_app_enabled bool**.

---

## 12. Company profiles (DECIDED — staff reference library)
**company_profiles** — multi-row document library for firm capability / company profile packs that staff
can browse and download: `id` uuid PK, `name`, `storage_key`, `file_name`, `mime_type` null,
`size_bytes` null, `is_active` bool, `created_by` FK null, `created_at`, `updated_at`.
Managed via `/api/company-profiles` (`company-profile:view` / `:manage`). Soft-delete via `is_active`.
_(Replaces the interim settings-singleton idea; restores legacy library semantics with name + file only.)_

---

## 13. Audit trail  *(legacy `activity_log`)*
**activity_log** — id uuid PK, actor_id FK null (system), action, entity_type, entity_id uuid null,
ip_address inet null, metadata jsonb null (before/after), created_at. Append-only.

---

## 14. Async delivery  *(legacy `email_queue` → our outbox, enriched)*
**outbox** — id, event_type, payload jsonb, status enum(Pending,Queued,Sent,Failed), **attempts int**,
**max_attempts int**, **last_error text null** (from email_queue), processed_at null, created_at, updated_at.
Redis/BullMQ is the transport; the worker seals status (ARCHITECTURE §8).

---

## 15. Bulk import jobs (better representation of the legacy bulk-user flow)
Legacy: template download → upload → preview → validate → import (as loose PHP endpoints). Modelled as a
tracked job so preview/validation/results are first-class and auditable:
**bulk_import_jobs** — id uuid PK, kind enum(Users), status enum(Pending,Validated,Imported,Failed),
source_file_key, total_rows int, valid_rows int, error_rows int, result jsonb (per-row outcome),
created_by FK, created_at, completed_at null. (Row validation runs in the worker; preview returns the
validation `result` before the user commits the import.)

---

## 16. Legacy → new mapping (parity matrix)

| Legacy (aca) | New | Decision |
|--------------|-----|----------|
| users_details | `users` + `clients` (split people vs. org) | adapt |
| users_roles | `roles` | keep |
| users_access | — | **drop** (RBAC) |
| global_* (core) | `titles`/`genders`/`states`/`lgas`/`wards`/`banks`/`client_types`/`industries`/… | keep |
| global_courses / global_pension / positions / field_studied | — | ⚠ confirm/drop |
| request_client / request_client_sub | `requests` / (client submissions) | adapt |
| request_type / request_stage / global_request_status | `request_types` (under request class) / `request_stages` / `request_statuses` | adapt |
| assigned_auditors | `request_assignees` | keep |
| requesthistory | `request_history` | keep |
| client_response / client_response_sub | `client_submissions` / `submission_files` | keep |
| *_working_paper(_files) ×6 | `documents`(WorkingPaper) + `document_files` | **unify** |
| *_final_reports(_files) ×6 | `documents`(FinalReport) + `document_files` | **unify** |
| *_final_report_auditors/advisors/staffs | `document_participants` | **unify** |
| reviews | `reviews` | keep |
| company_profiles | `company_profiles` (name + file library) | keep (library) |
| notifications / notification_preferences | `notifications` / `notification_preferences` | keep |
| email_queue | `outbox` | adapt (Redis/BullMQ) |
| activity_log | `activity_log` | keep |
| settings | app config / `env` + a small `settings` KV if needed | ⚠ confirm |
| (bulk user import endpoints) | `bulk_import_jobs` | adapt |

---

## 17. Normalization
Still **3NF/BCNF**: no repeating groups (unified documents, junctions for many-to-many), no partial
dependencies (composite-key junctions carry only whole-key attributes), no transitive dependencies (FS
line derived from request type; labels live once in lookups; names/emails live once in `users`).

---

## 18. Open items to confirm
1. HR-ish lookups (`positions`, `field_studied`, `courses`, `pension`) — carry or drop?
2. `settings` table — is there app config that needs a DB KV store, or is env enough?
3. ~~Client vs. user split — client-contact login users live in `users` with `client_id`.~~ **Resolved:**
   contact people are `Client`-role `users`; each client has a `primary_contact_id` provisioned atomically
   at client creation (credentials emailed). Additional contacts addable later (story C-2).
4. Do final reports need the 3 distinct participant roles (Auditor/Advisor/Staff) exposed in UI, or is a
   single "participant" list enough?
