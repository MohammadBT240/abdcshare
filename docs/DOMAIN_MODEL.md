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
2. **FS lines** — within an engagement, requests are grouped by **FS lines** (financial-statement
   lines). Request types are defined *under* an FS line, and reporting is grouped the same way.

The old "service lines" are re-cast as **Departments** — they describe the firm's internal
organisational units (which team owns the work), not how work is grouped inside an engagement.

```
Legacy:   Client ── Request (type, stage, status) ── Documents
                    Documents grouped by Service Line (6)

Quantum:  Client ── Engagement (type, status, team) ── FS Line ── Request (of a Request Type) ── Documents
                    FS Lines group the requests, reports, and documents
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
  FS lines / workflow templates are available.
- **Period** — the reporting period the engagement covers (e.g. FY2025). *(optional / to confirm)*
- **Status lifecycle** — `Planning → Fieldwork → Review → Completed → Archived`, each with
  dates and an owner.
- **Assigned team** — the people staffed on the engagement (e.g. Partner, Manager, Auditors),
  each with an engagement role.
- **Department** — the internal unit that owns the engagement.

### FS Line  *(new — "Financial Statement line")*
A grouping category *within an engagement* (e.g. Cash & Bank, Receivables, Revenue, Payables,
PP&E). FS lines are **created and managed like request types were in ACA** (an admin-maintained
catalogue). Request types are grouped under FS lines, and requests, documents, and reports all
inherit that grouping. An FS line can be reused across engagements of a compatible type.

### Request Type
A named template of work item (e.g. "Bank confirmation", "Lead schedule"), now **grouped under
an FS line**. Carries an expected number of documents (`documents_no` in ACA). Maintained by
admins in a catalogue.

### Request
A single unit of work **inside an engagement**, created from a Request Type and therefore
belonging to an FS line. Attributes carried over and extended from ACA's `request_client`:

- Belongs to one Engagement (and thus one Client) and one FS line.
- **Request type**, **description**, **stage**, **status**, **due date**.
- **Assigned owner(s)** — auditor/staff responsible.
- **Attached documents** (working papers) and **client responses/submissions**.
- **Discussion thread** with read-tracking (carried over from ACA's discussion feature).

### Request Stage & Request Status
Lookup catalogues that drive a request's workflow (e.g. stage: Not Started / In Progress /
Submitted / Reviewed; status: Open / Pending Client / Accepted / Returned). Admin-maintained.

### Document — Working Paper & Final Report
Files attached to the work. **Working papers** are draft/supporting files; **final reports** are
completed deliverables. In Quantum both are grouped by **FS line within an engagement** rather
than by the old service-line library. Stored privately (Cloudflare R2 or local fallback),
downloaded only through authenticated endpoints.

### Department  *(formerly "service line")*
An internal organisational unit (Assurance, Tax, Advisory, Business Development, Shared
Services, Other). Used to say *which team* owns an engagement and for staffing/reporting — **not**
for grouping requests inside an engagement (that is the FS line's job).

### User & Role
People who log in. Roles are unchanged from ACA (see §3).

### Notification & Activity Log
In-app notifications (with per-user email preferences) and an immutable audit trail of actions.

---

## 3. Roles (unchanged from ACA)

| Role | Nature | Summary |
|------|--------|---------|
| **Platform Admin** | Governance | User management, catalogues (FS lines, request types, stages), departments, company profile. Only role that performs governance writes. At least one must always exist. |
| **Super Admin** | Operations | Engagements, requests, document library, reports, deletes, analytics. Read-only visibility into governance areas. |
| **Auditor** | Operations | Works engagements/requests assigned to them; uploads working papers and final reports; responds in discussions. |
| **Staff** | Library | Access to working papers and final reports; no engagement/request administration. |
| **Client** | Self-service | Sees their own engagements/requests, submits responses and documents, participates in discussions. |

---

## 4. Entity relationship (conceptual)

```
Client 1───* Engagement
Engagement *───1 EngagementType
Engagement *───1 Department
Engagement 1───* TeamAssignment *───1 User
Engagement 1───* Request
FSLine 1───* RequestType
RequestType 1───* Request
Request *───1 FSLine        (via its request type / explicit link)
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
| **FS line** | Financial-statement line; grouping of request types / requests / reports within an engagement. |
| **Request type** | Reusable template of a work item, defined under an FS line. |
| **Request** | A single work item inside an engagement, created from a request type. |
| **Working paper** | Draft / supporting document attached to a request. |
| **Final report** | Completed deliverable document, grouped by FS line. |
| **Department** | Internal org unit (formerly "service line"); owns engagements and staff. |
| **Stage / Status** | Workflow position and state of a request. |
| **Client submission** | A document or response uploaded by a client against a request. |
| **Discussion** | Threaded messages on a request, with per-user read tracking. |
