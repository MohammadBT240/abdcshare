# Quantum — User Stories

> Product requirements for the Quantum portal, the Next.js successor to ACA / ABDC.
> Read **DOMAIN_MODEL.md** first for entity definitions and terminology.
>
> **Status:** Draft for review. Sections marked _🆕 NEW_ are proposed enhancements beyond
> the legacy ACA feature set — please approve, cut, or defer each. Sections marked _↔ PARITY_
> carry existing ACA behaviour forward (restructured around engagements/FS lines).

---

## How to read this document

Each story uses the form:

> **As a** _role_, **I want** _capability_, **so that** _benefit_.

Every story has **acceptance criteria** (AC) — the testable conditions for "done". Stories are
grouped into **epics**. Each story has an ID (`Q-<epic>-<n>`) for traceability into the backlog,
and a **priority** using MoSCoW: **M**ust / **S**hould / **C**ould / **W**on't-yet.

**Roles:** Platform Admin (PA), Super Admin (SA), Auditor (AU), Staff (ST), Client (CL).

---

## Epic index

| # | Epic | Theme |
|---|------|-------|
| A | Authentication & Account | Login, password, sessions ↔ PARITY |
| B | User & Role Administration | Governance of users/roles ↔ PARITY |
| C | Catalogues: FS Lines, Request Types, Stages | Admin-maintained reference data 🆕 restructured |
| D | Departments | Internal org units ↔ PARITY (renamed) |
| E | Engagements | New top-level container 🆕 NEW |
| F | Requests within Engagements | Grouped by FS line 🆕 restructured |
| G | Documents: Working Papers & Final Reports | Grouped by FS line 🆕 restructured |
| H | Client Portal | Self-service for clients ↔ PARITY |
| I | Discussions & Collaboration | Threaded messaging 🆕 enhanced |
| J | Review & Approval Workflow | Preparer → reviewer → sign-off 🆕 NEW |
| K | Dashboards & Analytics | Progress, workload, deadlines 🆕 NEW |
| L | Notifications | In-app + email preferences ↔ PARITY enhanced |
| M | Search, Reporting & Exports | Cross-engagement views 🆕 enhanced |
| N | Audit Trail & Activity Log | Immutable history 🆕 enhanced |
| O | Company Profile & Settings | Firm profile ↔ PARITY |

---

## Epic A — Authentication & Account  ↔ PARITY

**Q-A-1 (M)** — As **any user**, I want to log in with email and password, so that I can access
the portal securely.
- AC: Credentials verified against hashed passwords; invalid attempts rejected with a generic message.
- AC: Login is CSRF-protected and rate-limited per IP.
- AC: Successful login records an entry in the activity log and starts a secure session.

**Q-A-2 (M)** — As **any user**, I want to be forced to change my password on first login, so that
admin-set temporary passwords are never kept.
- AC: If `must_change_password` is set, all pages except logout are blocked until the password is changed.
- AC: The new password must meet complexity rules; the flag clears on success.

**Q-A-3 (M)** — As **any user**, I want to reset a forgotten password by email, so that I can regain
access without an admin.
- AC: Request generates a single-use, time-limited token emailed to the registered address.
- AC: Using the token lets me set a new password; the token is invalidated after use/expiry.
- AC: Requesting a reset for an unknown email returns the same neutral response (no user enumeration).

**Q-A-4 (M)** — As **any user**, I want to change my password while logged in, so that I can keep my
account secure.
- AC: Requires current password; on success sends a confirmation email and re-authenticates the session.

**Q-A-5 (M)** — As **any user**, I want to log out, so that my session ends on shared devices.
- AC: Session destroyed; redirect to login.

**Q-A-6 (S)** — As **any user**, I want my session to expire after inactivity, so that unattended
sessions are not left open.
- AC: Idle timeout configurable; expired sessions require re-login.

**Q-A-7 (M)** — As **any user**, I want to view and update my own profile (name, contact details,
avatar), so that my information stays current. ↔ PARITY (`profile-request` / My-Profile)
- AC: User can edit their own profile fields and upload an avatar (validated, processed/resized).
- AC: Changes are saved and reflected in the header/UI; the update is logged.

---

## Epic B — User & Role Administration  ↔ PARITY

**Q-B-1 (M)** — As a **Platform Admin**, I want to create users with a role, so that people can access
the portal with the right permissions.
- AC: Only Platform Admin can create users (governance write).
- AC: New user receives login credentials by email and is flagged `must_change_password`.
- AC: Email uniqueness enforced; role selected from the role catalogue.

**Q-B-2 (M)** — As a **Platform Admin**, I want to edit a user's details, role, and active status, so
that access stays accurate as people change teams or leave.
- AC: Deactivating a user blocks their login without deleting history.
- AC: Changing a role updates the user's page access immediately on next request.

**Q-B-3 (M)** — As a **Platform Admin**, I want the system to prevent removing the last Platform Admin,
so that governance can never be locked out.
- AC: Delete/deactivate/role-change is blocked if it would leave zero active Platform Admins.

**Q-B-4 (S)** — As a **Platform Admin**, I want to reset a user's password, so that I can help users
who are locked out.
- AC: Sets a temporary password + `must_change_password`; notifies the user by email.

**Q-B-5 (M)** — As a **Super Admin**, I want read-only visibility of the users report, so that I can see
who has access without being able to change governance.
- AC: SA sees the users list/report but all create/edit/delete controls are hidden/blocked server-side.

**Q-B-6 (S)** — As a **Platform Admin**, I want an accounts/users report with filters and export, so
that I can audit who has access.
- AC: Filter by role, department, status; export to CSV/Excel.

---

## Epic C — Catalogues: FS Lines, Request Types, Stages  🆕 restructured

**Q-C-1 (M)** — As a **Platform Admin**, I want to create and manage **FS lines**, so that engagements
have a consistent set of financial-statement groupings.
- AC: FS line has a name, optional code, description, and active flag.
- AC: FS lines are managed the same way request types were in ACA (list + create/edit/deactivate).
- AC: Deactivating an FS line hides it from new selections but preserves existing links.

**Q-C-2 (M)** — As a **Platform Admin**, I want to create **request types grouped under an FS line**, so
that work items are organised by financial-statement line.
- AC: A request type must be assigned to exactly one FS line.
- AC: Request type carries an expected document count (`documents_no` equivalent) and active flag.
- AC: The request-type list can be filtered/grouped by FS line.

**Q-C-3 (S)** — As a **Platform Admin**, I want to optionally scope which FS lines apply to which
**engagement type**, so that a tax engagement doesn't surface audit-only FS lines.
- AC: Each engagement type can have an allowed set of FS lines; empty set = all allowed.

**Q-C-4 (M)** — As a **Platform Admin**, I want to manage **request stages** and **statuses**, so that
the request workflow reflects our process.
- AC: CRUD on stage and status catalogues; ordering supported; in-use values cannot be hard-deleted (deactivate instead).

**Q-C-5 (S)** — As a **Super Admin**, I want read-only visibility of these catalogues, so that I can
understand configuration without changing governance.
- AC: SA can view FS lines, request types, stages, statuses; cannot create/edit/delete.

---

## Epic D — Departments  ↔ PARITY (renamed from "service lines")

**Q-D-1 (M)** — As a **Platform Admin**, I want to manage departments (Assurance, Tax, Advisory,
Business Development, Shared Services, Other, and any new ones), so that engagements and staff can be
assigned to the right internal unit.
- AC: CRUD on departments with name and active flag.

**Q-D-2 (S)** — As a **Platform Admin**, I want to assign users to a default department, so that
staffing and reporting can be grouped by team.
- AC: A user can have a home department; used in reports and default engagement staffing.

---

## Epic E — Engagements  🆕 NEW (core new capability)

**Q-E-1 (M)** — As a **Super Admin / Auditor (with permission)**, I want to open an engagement for a
client, so that all related requests and documents live in one container.
- AC: Engagement requires a client, an engagement type, and an owning department.
- AC: Optional period (e.g. FY2025) and start/target-completion dates.
- AC: Engagement gets a unique human-readable ID; creation is logged.

**Q-E-2 (M)** — As a **Super Admin / Auditor**, I want to move an engagement through its status
lifecycle (Planning → Fieldwork → Review → Completed → Archived), so that progress is visible and
controlled.
- AC: Status transitions follow allowed order; each transition records who/when.
- AC: Completing an engagement requires all requests to be in a terminal state (configurable warning vs. block).
- AC: Archived engagements are read-only but remain viewable/reportable.

**Q-E-3 (M)** — As a **Super Admin**, I want to assign a team to an engagement (e.g. Partner, Manager,
Auditors) with engagement roles, so that responsibilities are clear.
- AC: Add/remove team members with an engagement role; at least one owner required.
- AC: Only assigned team members (plus admins) can act on the engagement's requests.
- AC: Team changes are logged.

**Q-E-4 (M)** — As an **assigned team member**, I want an engagement workspace that shows its FS lines
with the requests grouped under each, so that I can navigate the work at a glance.
- AC: Engagement page lists FS lines; each FS line shows its requests with stage/status/due date.
- AC: Progress per FS line and overall engagement completion % are shown.

**Q-E-5 (S)** — As a **Super Admin / Auditor**, I want to add FS lines to an engagement (from the
catalogue), so that only relevant lines appear in this engagement.
- AC: Select from allowed FS lines for the engagement type; added lines appear in the workspace.
- AC: An FS line with requests cannot be removed without confirmation/reassignment.

**Q-E-6 (C)** — As a **Super Admin**, I want to create an engagement from a template (predefined FS
lines + request types), so that setting up a standard audit is fast.
- AC: Selecting a template pre-populates FS lines and stub requests; each can be edited after.

**Q-E-7 (S)** — As a **Super Admin**, I want to clone last period's engagement for a returning client,
so that recurring work doesn't start from scratch.
- AC: Clone copies structure (FS lines, request types, team) but not documents/statuses.

**Q-E-8 (M)** — As a **Client**, I want to see the engagements that belong to me, so that I know what
work is in progress.
- AC: Client sees only their own engagements, read-only except for their request responses.

**Q-E-9 (S)** — As a **Super Admin**, I want to delete/close an engagement created in error, so that the
list stays clean.
- AC: Delete restricted (SA/PA); blocked or soft-deleted if it has activity; logged.

---

## Epic F — Requests within Engagements  🆕 restructured

**Q-F-1 (M)** — As an **Auditor / Super Admin**, I want to create a request inside an engagement from a
request type, so that the work item is correctly grouped under its FS line.
- AC: Selecting a request type auto-assigns the FS line; request inherits engagement + client.
- AC: Request has description, due date, assigned owner(s), stage, status.
- AC: Creation is logged and can notify the client/owner.

**Q-F-2 (M)** — As an **Auditor**, I want to update a request's stage and status, so that its progress
is tracked.
- AC: Stage/status chosen from catalogues; each change logged with who/when.
- AC: Status changes can trigger notifications (e.g. "Pending Client").

**Q-F-3 (M)** — As an **Auditor / Super Admin**, I want to assign or reassign the auditor(s) on a
request, so that ownership is clear.
- AC: Only engagement team members can be assigned; reassignment logged and notified.

**Q-F-4 (M)** — As an **Auditor**, I want to set and change a request's due date, so that deadlines are
tracked.
- AC: Overdue requests are flagged in lists and dashboards.

**Q-F-5 (M)** — As an **Auditor / Super Admin**, I want to view all requests in an engagement grouped
by FS line, filter and sort them, so that I can manage the workload.
- AC: Server-side paginated list (DataTables-equivalent) filterable by FS line, stage, status, owner, due date.

**Q-F-6 (S)** — As an **Auditor**, I want to bulk-update requests (e.g. reassign or change stage), so
that I can manage many at once.
- AC: Multi-select with a bulk action; each affected request logged.

**Q-F-7 (M)** — As an **Auditor / Super Admin**, I want to delete a request created in error, so that
the engagement stays accurate.
- AC: Delete restricted and logged; attached documents handled (blocked or cascade with confirmation).

**Q-F-8 (S)** — As an **Auditor**, I want request history (requesthistory equivalent) on each request,
so that I can see how it evolved.
- AC: Chronological list of stage/status/assignment/document events on the request.

---

## Epic G — Documents: Working Papers & Final Reports  🆕 restructured

**Q-G-1 (M)** — As an **Auditor / Staff**, I want to upload working papers against a request/FS line, so
that supporting evidence is stored with the work.
- AC: Upload validated for size and MIME type; stored privately (R2 or local fallback).
- AC: Document is grouped by its FS line within the engagement; DB stores basename, storage holds the object.
- AC: Upload progress is shown for large files; upload is logged.

**Q-G-2 (M)** — As an **Auditor / Super Admin**, I want to upload final reports grouped by FS line, so
that deliverables are organised consistently.
- AC: Final reports listed per FS line within the engagement; downloadable only via authenticated endpoint.

**Q-G-3 (M)** — As **any authorised user**, I want to download/preview a document securely, so that
sensitive files are never exposed by public URL.
- AC: Downloads go through an authenticated endpoint (presigned R2 redirect or local stream).
- AC: PDFs can be previewed inline; access is authorised against role + engagement membership.

**Q-G-4 (S)** — As an **Auditor**, I want document **versioning**, so that I can replace a file while
keeping history. 🆕 NEW
- AC: Uploading a new version supersedes the previous but keeps prior versions accessible with timestamps/uploader.

**Q-G-5 (S)** — As an **Auditor / Super Admin**, I want to export all documents/final reports for an
engagement or FS line as a zip, so that I can hand off a complete set.
- AC: Export bundles files by engagement/FS line; large exports handled reliably.

**Q-G-6 (M)** — As an **Auditor**, I want to delete a document uploaded in error, so that only correct
files remain.
- AC: Delete restricted and logged; storage object removed or orphan-cleaned.

---

## Epic H — Client Portal  ↔ PARITY

**Q-H-1 (M)** — As a **Client**, I want to see requests raised for my engagements, so that I know what
is expected of me.
- AC: Client sees only their own requests, grouped by engagement and FS line, with due dates and status.

**Q-H-2 (M)** — As a **Client**, I want to respond to a request and upload the requested documents, so
that I can fulfil what's asked.
- AC: Client can attach one or more files and a message against a request.
- AC: Submission notifies the assigned auditor and updates the request status.

**Q-H-3 (M)** — As an **Auditor / Super Admin**, I want to accept or return a client's submitted
document with a reason, so that quality is controlled.
- AC: Accept/return sets a document status; returning requires a reason and notifies the client.
- AC: Each decision is logged.

**Q-H-4 (S)** — As a **Client**, I want to see the status of each document I submitted (accepted /
returned / pending), so that I know what still needs action.
- AC: Per-document status visible to the client with any return reason.

---

## Epic I — Discussions & Collaboration  🆕 enhanced

**Q-I-1 (M)** — As **any authorised participant**, I want a threaded discussion on a request, so that
questions and answers stay attached to the work.
- AC: Messages are chronological; author and timestamp shown; participants are engagement team + client.

**Q-I-2 (M)** — As **any participant**, I want unread discussion messages tracked, so that I can see
what's new. ↔ PARITY (read-tracking)
- AC: Per-user read state; unread count surfaced in the UI and notifications.

**Q-I-3 (S)** — As **any participant**, I want to be emailed when a new discussion message is posted
(per my preferences), so that I don't miss it.
- AC: Email sent respecting the user's notification preferences; links back to the request.

**Q-I-4 (C)** — As **any participant**, I want to @-mention a teammate, so that I can direct a question.
🆕 NEW
- AC: Mentioned users get a targeted notification.

**Q-I-5 (C)** — As **any participant**, I want to attach a file to a discussion message, so that context
travels with the conversation. 🆕 NEW
- AC: Attachment stored securely and downloadable via authenticated endpoint.

---

## Epic J — Review & Approval Workflow  🆕 NEW (proposed)

> Proposed to add rigour suited to audit work. Please confirm the number of levels.

**Q-J-1 (S)** — As an **Auditor (preparer)**, I want to submit a request/working paper for review, so
that a reviewer can check it.
- AC: Submitting sets a "For review" state and notifies the assigned reviewer.

**Q-J-2 (S)** — As a **Reviewer (Manager/Super Admin)**, I want to approve or send back a submission
with review notes, so that quality is enforced.
- AC: Approve advances the item; send-back returns it to the preparer with mandatory notes; both logged.

**Q-J-3 (C)** — As a **Partner (Super Admin)**, I want to give final sign-off on an FS line or
engagement, so that completion is authorised.
- AC: Sign-off locks the item from further edits; recorded with who/when; reversible only by a higher role with a reason.

**Q-J-4 (C)** — As a **Reviewer**, I want a review queue of everything awaiting my review, so that
nothing is missed.
- AC: Queue lists items in "For review" assigned to me, sortable by due date/engagement.

---

## Epic K — Dashboards & Analytics  🆕 NEW (proposed)

**Q-K-1 (M)** — As a **Super Admin / Partner**, I want a firm-wide dashboard, so that I can see all
active engagements and their health.
- AC: Shows counts by engagement status, overdue requests, upcoming deadlines, and completion %.

**Q-K-2 (M)** — As an **Auditor**, I want a personal dashboard of my assigned requests and deadlines, so
that I know what to work on.
- AC: Lists my open requests grouped by engagement, flagged for overdue/due-soon.

**Q-K-3 (S)** — As a **Super Admin**, I want per-engagement analytics (progress by FS line, aging of
requests, workload by team member), so that I can manage delivery.
- AC: Charts/tables for FS-line progress, request aging, and per-member load.

**Q-K-4 (S)** — As a **Client**, I want a simple dashboard of what's outstanding on my side, so that I
can act quickly.
- AC: Shows my pending requests and returned documents needing re-submission.

**Q-K-5 (C)** — As a **Platform Admin**, I want a governance dashboard (user counts by role/department,
catalogue health), so that I can oversee configuration.
- AC: Summary tiles + quick links to governance areas.

---

## Epic L — Notifications  ↔ PARITY enhanced

**Q-L-1 (M)** — As **any user**, I want in-app notifications for events relevant to me (assignments,
status changes, submissions, discussions), so that I stay informed.
- AC: Notifications stored per user, with unread count and a notifications panel; polling/real-time update.

**Q-L-2 (M)** — As **any user**, I want to set my notification preferences (which events email me), so
that I control my inbox.
- AC: Per-event email on/off; in-app always on; respected by all notification triggers.

**Q-L-3 (M)** — As **the system**, I want to send transactional emails (account created, credentials,
password reset/changed, request created, status updated, document accepted/returned, discussion
posted), so that users are kept in the loop off-platform.
- AC: Emails rendered from templates; delivery via SMTP; failures logged; content matches the in-app event.

**Q-L-4 (S)** — As **an Auditor/Client**, I want deadline reminders for due/overdue requests, so that
nothing slips. 🆕 NEW
- AC: Scheduled reminders sent before and on due date, respecting preferences.

---

## Epic M — Search, Reporting & Exports  🆕 enhanced

**Q-M-1 (S)** — As a **Super Admin / Auditor**, I want to search across engagements, clients, requests,
and documents, so that I can find work quickly. 🆕 NEW
- AC: Global search with role-scoped results; matches on client, engagement ID, request, FS line, document name.

**Q-M-2 (M)** — As a **Super Admin**, I want reports of requests and documents grouped by FS line, so
that reporting mirrors the new structure.
- AC: Reports grouped by FS line within an engagement (and roll-up across engagements); server-side paginated.

**Q-M-3 (S)** — As a **Super Admin**, I want to export reports (requests, documents, accounts) to
CSV/Excel and bundle documents to zip, so that I can share outside the system.
- AC: Exports respect current filters; large exports handled reliably.

**Q-M-4 (C)** — As a **Super Admin**, I want an engagement status report across all clients, so that I
can brief partners.
- AC: One view of all engagements with status, completion %, overdue counts; exportable.

---

## Epic N — Audit Trail & Activity Log  🆕 enhanced

**Q-N-1 (M)** — As a **Platform / Super Admin**, I want an immutable activity log of significant actions
(logins, user changes, engagement/request/document changes, status transitions), so that we have an
audit trail.
- AC: Every significant action recorded with actor, timestamp, entity, and before/after where relevant.
- AC: Log is append-only; not editable through the UI.

**Q-N-2 (S)** — As a **Super Admin**, I want to view/filter the activity log per engagement or user, so
that I can investigate.
- AC: Filter by actor, entity type, date range, engagement; paginated; exportable.

---

## Epic O — Company Profile & Settings  ↔ PARITY

**Q-O-1 (M)** — As a **Platform Admin**, I want to manage the company/firm profile (name, logo, contact
details), so that branding and letterheads are correct.
- AC: PA can edit; changes reflected in UI and email templates/letterheads.

**Q-O-2 (M)** — As a **Super Admin / Auditor / Staff**, I want read-only visibility of the company
profile, so that I can reference firm details without changing governance.
- AC: These roles can view but not edit.

---

## Proposed enhancement summary (for your decision)

The items below are **new** beyond legacy ACA. Please mark each **Approve / Defer / Cut**:

| Epic / Story | Enhancement | Suggested priority |
|--------------|-------------|--------------------|
| E (all) | **Engagements** as the top-level container | Must (core of this project) |
| C-2, C-3 | Request types grouped under **FS lines**; FS lines scoped by engagement type | Must |
| E-6, E-7 | Engagement **templates** & **clone last period** | Could |
| G-4 | Document **versioning** | Should |
| I-4, I-5 | Discussion **@-mentions** & **attachments** | Could |
| J (all) | **Review & approval workflow** (preparer → reviewer → partner sign-off) | Should |
| K (all) | **Dashboards & analytics** (firm, personal, engagement, client, governance) | Must/Should |
| L-4 | **Deadline reminders** | Should |
| M-1, M-4 | **Global search** & firm-wide engagement status report | Should |
| N (all) | Enhanced **immutable audit trail** | Must |

---

## Open questions to confirm before backlog grooming

1. **Engagement period** — should every engagement carry a fiscal year/reporting period? (Assumed optional.)
2. **Review levels** — how many review tiers (single reviewer, or preparer → manager → partner)?
3. **FS line ↔ engagement type** — should FS lines be restricted per engagement type, or a global list?
4. **Who can create engagements** — Super Admin only, or Auditors too (with permission)?
5. **Departments** — keep the existing six, or will you add/rename any at launch?
6. **Client visibility** — can clients see working papers/final reports, or only their own submissions and request statuses?
