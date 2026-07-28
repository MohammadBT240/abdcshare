# abdcshare — User Stories · v2 (full parity)

> Product requirements, **rebuilt to full capability parity** with the legacy ACA system
> (`LEGACY_AUDIT.md`) and re-represented in the new model (engagements + request classes, unified documents,
> RBAC). Entities: see **ERD.md v3**. Permissions: `@abdcshare/shared` (`ROLE_PERMISSIONS` +
> `DESIGNATION_PERMISSIONS`).
>
> Format: **As a** _role_, **I want** _capability_, **so that** _benefit_ — with acceptance criteria (AC),
> the guarding **permission**, and MoSCoW priority. Roles: Platform Admin (PA), Super Admin (SA),
> Staff (ST), Client (CL), Guest (invited to submit a Chairman report). Sub-flags on SA: Principal Partner (PP), Partner (PT).
> **(v5: `Auditor` is no longer a role — every Staff is a working practitioner; "Auditor" is now only a
> per-engagement team tag. Engagements are created by Super Admin only; Staff are row-scoped to the
> engagements they're attached to.)**
>
> **Parity rule:** every legacy capability is represented here (with a keep/adapt/drop note where it
> changed). Sections marked _🆕_ are new beyond legacy.

---

## Epic index

| # | Epic | Perm domain |
|---|------|-------------|
| A | Authentication & own profile | — |
| B | User administration (incl. bulk import) | `user:*`, `bulk-import:run` |
| C | Clients | `client:*` |
| D | Reference data (`global_*` lookups) | `reference-data:*` |
| E | Catalogues (request classes, request types, stages, statuses, engagement types) | `catalogue:*` |
| F | Departments | `department:manage` |
| G | Company profile (firm settings singleton) | `company-profile:*` |
| H | Engagements | `engagement:*` |
| I | Requests | `request:*` |
| J | Client submissions | `submission:*` |
| K | Documents (working papers & final reports) | `working-paper:upload`, `final-report:upload`, `document:*` |
| L | Reviews & sign-off | `review:*` |
| M | Discussions | `discussion:participate` |
| N | Notifications | `notification:receive` |
| O | Partner weekly reports 🆕 | `partner-report:*` |
| P | Dashboards & analytics 🆕 | (role-scoped) |
| Q | Search, reporting & exports | `document:export`, view perms |
| R | Audit trail | `audit:view` |

---

## Epic A — Authentication & own profile

- **A-1 (M)** Log in with email + password. AC: hashed verify, CSRF, rate-limit, activity-log entry, secure session/JWT.
- **A-2 (M)** Forced password change on first login (`must_change_password`). AC: all routes except change-password/logout blocked until changed.
- **A-3 (M)** Forgot/reset password by email. AC: single-use, time-limited token; neutral response (no user enumeration).
- **A-4 (M)** Change password while logged in. AC: current-password check; confirmation email; all refresh sessions revoked.
- **A-5 (M)** Log out (single session) / **A-5b (S)** log out everywhere.
- **A-6 (M)** View & edit **own full profile** — title, first/middle/surname, gender, marital status, **one** phone, official & residential address, avatar (upload + remove). AC: fields validated; avatar processed/resized; change logged. _(parity: legacy `profile-request`)_

## Epic B — User administration

- **B-1 (M, PA)** Create a user with **full profile** (title, names, gender, marital status, phone, addresses, role, department, avatar). AC: email unique; temp password generated; `must_change_password`; `user.created` outbox → worker emails credentials. `user:manage`.
- **B-2 (M, PA)** Edit user details, role, department, active status. AC: deactivate blocks login, keeps history. `user:manage`.
- **B-3 (M, PA)** Last-Platform-Admin guard: cannot remove/deactivate/demote the final active PA. `user:manage`.
- **B-4 (S, PA)** Admin reset a user's password. AC: temp password + `must_change_password`; email notice. `user:manage`.
- **B-5 (M, SA/PA)** Users/accounts report — paginated, filter by role/department/status; **export CSV/Excel**. `user:view`. _(parity: accounts-report + exports)_
- **B-6 (M, PA)** **Bulk user import** 🔁: download template → upload CSV/Excel → **preview** with per-row validation → **commit import**. AC: tracked as a `bulk_import_jobs` run; invalid rows reported with reasons; only valid rows imported; each created user emailed. `bulk-import:run`. _(parity: download_bulk_users_template / preview_bulk_users / import_bulk_users + BulkUserImportParser/RowValidator/UserAccountService)_
- **B-7 (M, PA)** Assign a Super Admin's **partner designation** (Partner / Principal Partner / none). AC: only SA users; **at most one Principal Partner** (guarded); change logged. `user:manage`. 🆕

## Epic C — Clients

- **C-1 (M, PA)** Create/edit a client organisation — name, client type, company name, registered/official/residential address, incorporation date & no., email, phone. Creating a client **requires a primary contact** (title?, first/middle/surname, email, phone) and **provisions that contact's login atomically**: a `role = Client` user linked to the client, with a temp password, `must_change_password`, and a `user.created` event that emails the credentials. `client:manage`. _(industry/category/bank/state/LGA/ward dropped from the client — v4.)_
- **C-2 (M, PA)** Manage additional client **contact users** beyond the primary (create/link login users with `role = Client`). `client:manage` + `user:manage`.
- **C-3 (M, SA/PA)** List/search clients (paginated, filters), view a client overview (its engagements, requests, documents). `client:view`. _(parity: Client-Overview)_
- **C-4 (S)** Export the client list (CSV/Excel). `client:view`.

## Epic D — Reference data (`global_*` lookups)

- **D-1 (M, PA)** Manage core lookups — titles, genders, marital statuses, client types, industries, categories, banks, states, LGAs (per state), wards (per LGA), request statuses, general statuses. AC: CRUD + active flag; in-use values deactivated not hard-deleted. `reference-data:manage`.
- **D-2 (M, all editors)** Read lookups for form dropdowns (cascading state→LGA→ward). `reference-data:view` (or public-ish read for authed users). _(parity: getters for states/cities/wards)_
- **D-3 (C, PA)** _⚠ confirm_ HR-ish lookups (positions, field studied, courses, pension) — enable only if you confirm they're needed.

## Epic E — Catalogues

- **E-1 (M, PA)** Manage **request classes** (name, code, description, active). `catalogue:manage`.
- **E-2 (M, PA)** Manage **request types grouped under a request class** (name, expected documents, active; unique per request class). `catalogue:manage`. _(parity: add/update-request-type)_
- **E-3 (S, PA)** Scope which request classes apply to which **engagement type**. `catalogue:manage`.
- **E-4 (M, PA)** Manage **request stages** and **statuses** (ordering; deactivate in-use). `catalogue:manage`.
- **E-5 (M, PA)** Manage **engagement types**. `catalogue:manage`.
- **E-6 (M, SA)** Read-only view of all catalogues. `catalogue:view`.

## Epic F — Departments

- **F-1 (M, PA)** Manage departments (Assurance, Tax, Advisory, Business Dev, Shared Services, Other; add/rename/deactivate). `department:manage`. _(formerly service lines)_
- **F-2 (S, PA)** Assign users a home department.

## Epic G — Company profile _(decided: a settings singleton, not a library)_

- **G-1 (M, PA)** Manage the firm's **company profile** — a single record: name, logo, email, phone, address (letterhead / branding source). `company-profile:manage`.
- **G-2 (M, SA/ST)** View the company profile. `company-profile:view`.

## Epic H — Engagements

- **H-1 (M, SA)** Open an engagement for a client (client, engagement type, department, optional period, dates). AC: unique reference code; logged. `engagement:create`.
- **H-2 (M, SA)** Stage lifecycle **Planning→Execution→Reporting→Completed→Archived**, with history + owners. AC: allowed transitions only; **completion requires every in-scope request class to be signed off** (or an engagement-wide sign-off). `engagement:transition`.
- **H-6 (M, team)** **Stage-tagged work items:** requests and documents carry the engagement stage they belong to (Planning/Execution/Reporting, default = current stage) — so *planning preliminaries* (client requests + team uploads with `phase=Planning`) group together. 🆕
- **H-7 (M, team)** **General supporting documents** — engagement-level reference material with no request class (`category=Supporting`), uploadable by any team member for future reference. `working-paper:upload`. 🆕
- **H-3 (M, SA)** Assign engagement team (Partner/Manager/Auditor roles). AC: only team + admins can act on its requests. `engagement:update`.
- **H-4 (M, team)** Engagement workspace: request classes with grouped requests, progress %, documents. `engagement:view`.
- **H-5 (S, SA)** Add request classes to an engagement (from allowed set). `engagement:update`.
- **H-6 (C, SA)** Create from **template** / **clone last period** (structure only). `engagement:create`. 🆕
- **H-7 (M, CL)** Client sees only their own engagements. `engagement:view`.

## Epic I — Requests

- **I-1 (M, ST/SA)** Create a request from a request type (auto request class); description, due date, owner(s), stage, status. `request:create`. _(parity: request-client)_
- **I-2 (M, ST)** Update stage & status (logged; can notify). `request:update`. _(update-request-stage/status)_
- **I-3 (M, ST/SA)** Assign/reassign request assignees (staff on the engagement). `request:assign`. _(update-auditors / assigned_auditors)_
- **I-4 (M, ST)** Set/change due date; overdue flagged. `request:update`.
- **I-5 (M, team)** Paginated request grid grouped by request class; filter by request class/stage/status/owner/due. `request:view`.
- **I-6 (S, ST)** Bulk update (reassign / change stage). `request:update`.
- **I-7 (M, ST/SA)** Delete a request created in error (logged). `request:update`.
- **I-8 (S, team)** Request history timeline. `request:view`. _(requesthistory)_

## Epic J — Client submissions

- **J-1 (M, CL)** See requests raised for my engagements, grouped by engagement/request class, with due dates & status. `request:view`.
- **J-2 (M, CL)** Respond to a request and upload the requested document(s) (message + files). AC: notifies assigned auditor; updates status. `submission:respond`. _(client-response / client_response_sub)_ ✅
- **J-3 (M, ST/SA)** Accept or return a submitted document with reason. AC: return requires reason; per-file status; notifies client; logged. `submission:review`. _(update-response-document-status)_
- **J-4 (S, CL)** See per-document status (Pending/Accepted/Returned + reason).

## Epic K — Documents (working papers & final reports, unified)

- **K-1 (M, ST/SA)** Upload **working papers** to an engagement/request class — presigned direct-to-R2 → confirm → async processing; multiple files; versioned; attach participants (auditor/advisor/staff). `working-paper:upload`. _(parity: 6× *-working-paper)_
- **K-2 (M, SA only)** Upload **final reports** by request class — same flow, **Super Admin only**. `final-report:upload`. _(parity: 6× *-final-report)_
- **K-3 (M, authorised)** Secure download/inline preview (presigned GET; authorised vs engagement membership + `document:view`). `document:view`. _(parity: storage/download, viewer)_
- **K-4 (S, ST/SA)** Document **versioning** (re-upload = new version; history kept). 🆕
- **K-5 (M, ST/SA)** **Export** an engagement's / request class's documents as a zip (worker). `document:export`. _(parity: 13× export_*)_
- **K-6 (S, ST/SA)** **Bulk upload** many documents (presign many → confirm many). ✅
- **K-7 (M, SA)** Delete a document uploaded in error (logged; storage cleaned). `document:delete` (Super Admin only). _(parity: bulk_delete_audit_papers etc.)_

### Final-report client review cycle 🆕
- **K-8 (M, SA)** **Send a final-report draft to the client** for review. AC: report must have an uploaded version; creates a review cycle (round 1–3); notifies the client contact; state → AwaitingClient. `report-review:manage`.
- **K-9 (M, CL)** **View/download the draft and respond** — **approve** (finalises the report → SignedOff) or **request changes with feedback**. AC: client sees only their own engagement's reports awaiting review; approval can happen on any cycle. `report-review:respond`.
- **K-10 (M, SA)** Revise after changes (upload a new version) and **re-send** — up to **3 cycles total**. AC: a 4th send is blocked; changes requested on the 3rd cycle **locks** the report. `report-review:manage`.
- **K-11 (M, SA)** **Override** a locked report to finalise/issue it despite no client approval. AC: only from `Locked`; records who/why; state → Overridden, status → SignedOff. `report-review:manage`.

## Epic L — Reviews & sign-off

- **L-1 (S, ST)** Submit a request/working paper for review. `review:submit`.
- **L-2 (S, SA)** Approve or send back with mandatory notes. `review:decide`. _(parity: reviews)_
- **L-3 (C, SA)** Partner sign-off on a request class / engagement (locks from edits; reversible with reason). `review:signoff`.
- **L-4 (C, SA)** Review queue of items awaiting me. `review:decide`.

## Epic M — Discussions

- **M-1 (M, participants)** Threaded discussion on a request; author + timestamp. `discussion:participate`.
- **M-2 (M)** Unread tracking per user (unread counts). 
- **M-3 (S)** Email on new message (per preferences).
- **M-4 (C)** @-mentions with targeted notification. 🆕
- **M-5 (C)** Attach a file to a discussion message. 🆕

## Epic N — Notifications

- **N-1 (M)** In-app notifications for relevant events (assignment, status change, submission, discussion, sign-off, partner report). Cursor-paginated feed with unread count. `notification:receive`.
- **N-2 (M)** Per-event notification preferences (email on/off, in-app on/off). _(notification_preferences incl. in_app_enabled)_
- **N-3 (M, system)** Transactional emails via Resend (worker): credentials, reset/changed, request created/updated, document accepted/returned, discussion posted, partner-report reminder/submitted. _(parity: email_queue + templates)_
- **N-4 (S)** Deadline reminders for due/overdue requests. 🆕

## Epic O — Partner / Chairman reports 🆕 ✅

- **O-1 (M, PT/Guest)** Submit a **structured periodic report** to the Chairman — reporting officer, executive summary, financials, client/engagement updates, people & capacity, matters requiring decision, outlook. Draft→Submitted; notifies the Chairman. `partner-report:submit`. ✅ _(excludes Risk/Compliance/QA + Strategic Initiatives per decision)_
- **O-2 (M, PP)** Review any report; add review notes (Submitted→Reviewed); notifies the author. `partner-report:review`. ✅
- **O-3 (M, PP)** See **all** reports + dashboard, filter by period/status. `partner-report:view-all`. ✅
- **O-4 (M, PT/Guest)** See only my own reports & review status. `partner-report:view`. ✅
- **O-5 (M, PP)** 🆕 **Invite a guest** (email + name) to submit a report — a new email provisions a **`Guest`** login (temp password + login link; forced password change on first login); an email that **already has an account** is not re-provisioned but simply **reminded** to submit. `partner-report:invite`. ✅
- **O-6 (S, worker)** 🆕 **Periodic reminder** (weekly, Mondays 08:00) nudges guests with an outstanding invite (still `Invited`) to submit. `PartnerReportReminderService`. ✅

## Epic P — Dashboards & analytics 🆕

- **P-1 (M, SA/PP)** Firm dashboard: active engagements by status, overdue requests, upcoming deadlines, completion %. ✅ (headline counts built; charts/% pending)
- **P-2 (M, ST)** Personal dashboard: my assigned requests & deadlines. ✅
- **P-3 (S, SA)** Per-engagement analytics: request-class progress, request aging, workload by member.
- **P-4 (S, CL)** Client dashboard: outstanding requests & returned documents.
- **P-5 (C, PA)** Governance dashboard: users by role/department, catalogue/reference-data health.
- **P-6 (S, PP)** Partner-reporting dashboard: submission compliance per week.

## Epic Q — Search, reporting & exports

- **Q-1 (S, SA/ST)** Global search across engagements, clients, requests, documents (role-scoped). 🆕 ✅
- **Q-2 (M, SA)** Reports of requests & documents **grouped by request class** (per engagement + roll-up); paginated. `document:export`.
- **Q-3 (M, SA)** Export any report to CSV/Excel; bundle documents to zip (respecting filters).
- **Q-4 (C, SA)** Firm-wide engagement status report across clients.

## Epic R — Audit trail

- **R-1 (M, PA/SA)** Immutable activity log of significant actions (logins, user/client/catalogue changes, engagement/request/document changes, status transitions, sign-offs, partner-report actions). `audit:view`. _(parity: activity_log)_ ✅ (via a global audit interceptor)
- **R-2 (S, SA)** View/filter the log per engagement/user/date; export. `audit:view`.

---

## Legacy parity check (every capability represented)
- Bulk user import (template/preview/validate/import) → **B-6**.
- Exports on every document line (13×) → **K-5, Q-3**. Bulk delete → **K-7**.
- Full user/client profile fields → **A-6, B-1, C-1**. Reference data → **Epic D**.
- Requests / stages / statuses / assigned auditors / history → **Epic I**. Client responses → **Epic J**.
- Working papers & final reports (unified, final-report = SA) → **Epic K**. Reviews → **Epic L**.
- Notifications + preferences + email queue → **Epic N**. Company profiles (library) → **Epic G**.
- Activity log → **Epic R**. `users_access` → **dropped** (RBAC).

## New beyond legacy (🆕)
Engagements + request-class model, unified documents + versioning, partner designations & **weekly partner
reporting**, dashboards/analytics, global search, @-mentions & discussion attachments, deadline reminders.

## Open items
1. HR-ish lookups (D-3) — confirm/drop. 2. `settings` KV need? 3. Do final reports expose 3 participant
roles or one list? 4. Partner-report cadence/definition (assumed Monday-week, one per partner).
