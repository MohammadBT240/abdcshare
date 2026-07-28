# Quantum — Domain Model & Glossary

> The conceptual foundation for the Quantum portal, the Next.js successor to the ACA / ABDC
> practice-management application. This document defines the entities and terminology used
> throughout the user stories. Read this first.

---

## 1. What changes from ACA

In the legacy ACA app, a **client request** was a standalone record: it had a *request type*,
a *stage*, a *status*, a due date, and attached documents. Requests were loosely associated
with clients, and the document library (working papers / final reports) was grouped by six
**service lines** (Assurance, Tax, Advisory, Business Development, Shared Services, Other).

Quantum reorganises this around two new ideas:

1. **Engagements** — a request no longer floats on its own. Every request now lives inside an
   **Engagement**, which is opened for a specific client and represents a discrete piece of
   work (e.g. a statutory audit for FY2025).
2. **Request classes** — within an engagement, requests are grouped by **request classes**: an
   admin-maintained classification that request types are defined *under*, with reporting grouped the
   same way. (It replaces the old audit-specific "FS line" name so it fits every engagement type — for
   an audit a request class is a financial-statement line like Cash & Bank; for tax/advisory it's
   whatever grouping suits.)

The old "service lines" are re-cast as **Departments** — they describe the firm's internal
organisational units (which team owns the work), not how work is grouped inside an engagement.

```
Legacy:   Client ── Request (type, stage, status) ── Documents
                    Documents grouped by Service Line (6)

Quantum:  Client ── Engagement (type, status, team) ── Request Class ── Request (of a Request Type) ── Documents
                    Request Classes group the requests, reports, and documents
                    Departments = internal org units (formerly "service lines")
```

---

## 2. Core entities

### Client
An organisation Quantum does work for. A client can have many engagements over time.

### Engagement  *(new)*
A discrete body of work opened for **one client**. It is the top-level container that everything
else hangs off. Attributes:

- **Client** — who the engagement is for (inherent).
- **Engagement type** — e.g. Statutory Audit, Tax Compliance, Advisory. The type governs which
  request classes / workflow templates are available.
- **Period** — the reporting period the engagement covers (e.g. FY2025). *(optional / to confirm)*
- **Status lifecycle** — `Planning → Fieldwork → Review → Completed → Archived`, each with
  dates and an owner.
- **Assigned team** — the people staffed on the engagement (e.g. Partner, Manager, Auditors),
  each with an engagement role.
- **Department** — the internal unit that owns the engagement.

### Request Class  *(new — generalises the audit "FS line")*
A grouping/classification *within an engagement* (for an audit: Cash & Bank, Receivables, Revenue,
Payables, PP&E; for other engagement types, whatever grouping fits). Request classes are an
**admin-maintained catalogue**. Request types are grouped under request classes, and requests,
documents, and reports all inherit that grouping. A request class can be reused across engagements of a
compatible type.

### Request Type
A named template of work item (e.g. "Bank confirmation", "Lead schedule"), now **grouped under
a request class**. Carries an expected number of documents (`documents_no` in ACA). Maintained by
admins in a catalogue.

### Request
A single unit of work **inside an engagement**, created from a Request Type and therefore
belonging to a request class. Attributes carried over and extended from ACA's `request_client`:

- Belongs to one Engagement (and thus one Client) and one request class.
- **Request type**, **description**, **stage**, **status**, **due date**.
- **Assigned owner(s)** — the staff responsible.
- **Attached documents** (working papers) and **client responses/submissions**.
- **Discussion thread** with read-tracking (carried over from ACA's discussion feature).

### Request Stage & Request Status
Lookup catalogues that drive a request's workflow (e.g. stage: Not Started / In Progress /
Submitted / Reviewed; status: Open / Pending Client / Accepted / Returned). Admin-maintained.

### Document — Working Paper & Final Report
Files attached to the work. **Working papers** are draft/supporting files; **final reports** are
completed deliverables. In Quantum both are grouped by **request class within an engagement** rather
than by the old service-line library. Stored privately (Cloudflare R2 or local fallback),
downloaded only through authenticated endpoints.

### Department  *(formerly "service line")*
An internal organisational unit (Assurance, Tax, Advisory, Business Development, Shared
Services, Other). Used to say *which team* owns an engagement and for staffing/reporting — **not**
for grouping requests inside an engagement (that is the request class's job).

### User & Role
People who log in. Roles are **Platform Admin, Super Admin, Staff, Client** (see §3; `Auditor` is no
longer a role).

### Notification & Activity Log
In-app notifications (with per-user email preferences) and an immutable audit trail of actions.

---

## 3. Roles (v5 — Auditor dropped as a role)

Four roles. **`Auditor` is no longer a role** — every Staff is a working practitioner, and "Auditor"
survives only as a per-engagement **team tag** (member_role: Partner/Manager/Auditor) and a document
**participant role** (Auditor/Advisor/Staff).

| Role | Nature | Summary |
|------|--------|---------|
| **Platform Admin** | Governance | User management, catalogues (request classes, request types, stages), departments, company profile, bulk import, audit log. Only role that performs governance writes. At least one must always exist. Not in the engagement workflow. |
| **Super Admin** | Operations lead | **Only role that creates/manages engagements** (create, update, transition) and assigns staff to them. Full request lifecycle, uploads **working papers and final reports** (final-report = SA-only), deletes/exports documents, reviews submissions, decides reviews + sign-off. Read-only visibility into governance areas. May carry a **partner designation** (Partner / Principal Partner). |
| **Staff** | Working practitioner | Works inside the engagements they're **attached to** (team membership). Raises/updates/assigns requests, uploads working papers, reviews client submissions, participates in discussions, submits work for review. **Row-scoped** to their engagements. |
| **Client** | Self-service | Sees **only their own** client's engagements/requests, submits responses, participates in discussions, receives notifications. |
| **Guest** | Invited reporter | Invited by the Principal Partner solely to submit a **Chairman report**. Provisioned with a temp password + forced password change; sees only their own report(s). |

**Row-level scope:** Client → their client's rows; Staff → engagements they're on the team of (+ those
requests/documents); Platform/Super Admin → unrestricted. Enforced in the services (`common/security/access-scope.ts`).

---

## 4. Entity relationship (conceptual)

```
Client 1───* Engagement
Engagement *───1 EngagementType
Engagement *───1 Department
Engagement 1───* TeamAssignment *───1 User
Engagement 1───* Request
RequestClass 1───* RequestType
RequestType 1───* Request
Request *───1 RequestClass        (via its request type / explicit link)
Request 1───* Document (WorkingPaper | FinalReport)
Request 1───* ClientSubmission
Request 1───* DiscussionMessage *───* DiscussionRead
Request *───1 RequestStage
Request *───1 RequestStatus
User *───1 Role
```

---

## 5. Glossary

| Term | Meaning |
|------|---------|
| **Engagement** | Top-level container of work for one client; has a type, status lifecycle, and team. |
| **Request class** | Admin-maintained grouping/classification of request types / requests / reports within an engagement (an audit's financial-statement lines are one example). Formerly "FS line". |
| **Request type** | Reusable template of a work item, defined under a request class. |
| **Request** | A single work item inside an engagement, created from a request type. |
| **Working paper** | Draft / supporting document attached to a request. |
| **Final report** | Completed deliverable document, grouped by request class. |
| **Department** | Internal org unit (formerly "service line"); owns engagements and staff. |
| **Stage / Status** | Workflow position and state of a request. |
| **Client submission** | A document or response uploaded by a client against a request. |
| **Discussion** | Threaded messages on a request, with per-user read tracking. |
