# abdcshare — Full Product Replacement Quote

**Document type:** Change-order / project quote (gross rebuild)  
**Date:** 24 July 2026  
**Prior engagement (comparison only):** Legacy ACA application — **₦5,000,000**  
**This quote (fixed):** Full product replacement — **₦4,750,000**  
**Net vs prior:** **₦250,000 below** the original engagement, with materially more capability

---

## 1. Commercial position

| | Legacy engagement | This quote |
|---|---|---|
| **Amount** | ₦5,000,000 | **₦4,750,000** |
| **Status** | Prior / sunk (not credited) | **New fixed gross quote** |
| **Scope** | Then-current live app | **Full replacement:** API + background worker + web UI |
| **Client takeaway** | Paid ₦5M for the old system | Pays **₦4.75M** for a modern replacement **plus** first-class capabilities the legacy app did not deliver |

This is **not** an add-on to the ₦5M. It is a **standalone rebuild quote**. The ₦5M figure is shown only to make the disparity clear.

---

## 2. Why this is not “the same app cheaper”

The sell is **what the firm gains beyond the legacy product**, not a discount rewrite.

### 2.1 Headline disparity

| Dimension | Legacy (₦5M) | abdcshare rebuild (₦4.75M) |
|---|---|---|
| Architecture | Older monolithic patterns | NestJS API + worker + Next.js monorepo; transactional outbox |
| Access control | Legacy access patterns | JWT/RBAC, partner designation, **client + staff row-level scoping** |
| Engagement model | Legacy shape | Remodelled engagements, request classes, **phase-tagged work** |
| Documents | Fragmented legacy lines | Unified working papers / final reports / supporting docs + versioning |
| Client on final reports | Ad hoc / limited | **Formal multi-round client review cycle** (approve / changes / lock / override) |
| Partner operations | Not first-class product | **Weekly partner reports** (submit → Principal Partner review + reminders) |
| Insight & findability | Thin | **Dashboards, global search, deadline reminders** |
| Collaboration | Basic | Threaded discussions, @-mentions, attachments, in-app + email notifications |
| Audit | Activity log (legacy) | Immutable activity trail with queryable admin API |
| Deliverable | Old live app | **API + worker + full web product** |

### 2.2 New beyond legacy (🆕) — primary value of this quote

These are the capabilities that justify choosing the rebuild even when the price is **below** the old ₦5M:

1. **Partner designations + weekly partner reporting** — Partner / Principal Partner workflow, weekly submit/review, reminders.
2. **Final-report client review cycle** — Up to 3 review rounds; client approve or request changes; lock; Super Admin override.
3. **Dashboards & analytics** — Firm / staff / client-scoped operational views.
4. **Engagement phase tagging + supporting documents** — Planning / Execution / Reporting grouping; engagement-level reference uploads.
5. **Global search, deadline reminders, richer discussions, document versioning** — Findability, nudges, collaboration, audit-friendly history.

Legacy parity (auth, users, clients, catalogues, engagements, requests, submissions, documents, reviews, notifications, audit) is **included** so the firm is not left with a half-product — but the **commercial story leads with 🆕**.

---

## 3. Bill of Quantities

**Fixed project total: ₦4,750,000**

### 3.1 Summary

| Block | Role in the sell | Amount (₦) |
|---|---|---|
| **A. 🆕 Product upgrades** | Main selling point | **1,850,000** |
| **B. Core rebuild (legacy parity)** | Full operational replacement on a modern stack | **1,900,000** |
| **C. Web product + go-live** | Full UI replacement and handover | **1,000,000** |
| | **Total** | **4,750,000** |

---

### 3.2 Block A — 🆕 Product upgrades (₦1,850,000)

| Ref | Deliverable | Client outcome | ₦ |
|---|---|---|---|
| A1 | Partner designations + **weekly partner reports** | Partners submit weekly; Principal Partner reviews; reminders / escalation | 550,000 |
| A2 | **Final-report client review cycle** | Structured draft → client approve / request changes (≤3 cycles), lock, override | 400,000 |
| A3 | **Dashboards & analytics** | Live counts and role-scoped operational insight | 350,000 |
| A4 | Engagement **phase tagging** + **supporting documents** | Preliminaries and reference material grouped by stage | 250,000 |
| A5 | **Global search**, **deadline reminders**, discussion @-mentions & attachments, **document versioning** | Faster findability, fewer missed dues, richer collaboration | 300,000 |
| | **Block A subtotal** | | **1,850,000** |

---

### 3.3 Block B — Core rebuild / legacy parity (₦1,900,000)

| Ref | Deliverable | Maps to legacy ops | ₦ |
|---|---|---|---|
| B1 | Platform foundation — monorepo, JWT/RBAC, row-level scoping, outbox + worker/email | Auth / access (modernised) | 450,000 |
| B2 | Users (full profile, bulk import/export), clients + primary-contact login, reference data, catalogues, departments, company profile | Admin, org setup, lookups | 400,000 |
| B3 | Engagements, teams, request classes, requests, assignees, history, client submissions + files | Core engagement operations | 500,000 |
| B4 | Documents (working papers / final reports), reviews & sign-off, discussions, notifications, activity audit | Papers, review, comms, audit | 550,000 |
| | **Block B subtotal** | | **1,900,000** |

---

### 3.4 Block C — Web product + go-live (₦1,000,000)

| Ref | Deliverable | ₦ |
|---|---|---|
| C1 | Next.js web app — auth, role-aware shells, in-scope epic screens, API/BFF wiring | 750,000 |
| C2 | UAT support, go-live hardening, handover documentation | 250,000 |
| | **Block C subtotal** | **1,000,000** |

---

## 4. Scope of work (inclusions)

**In scope for ₦4,750,000:**

- Full product replacement: **API + worker + web UI**
- Legacy **capability parity** as represented in current product docs (`USER_STORIES` epics A–R, with agreed keep/adapt/drop notes)
- All **🆕 items** listed in Block A
- Standard UAT cycles and go-live support as in C2

**Out of scope (separate SoW / change order if required):**

- Legacy **database migration / cutover** of historical production data
- Cloud hosting, domains, third-party SaaS fees (Resend, R2/S3, etc.)
- Post-go-live retainer, SLA, or dedicated support hours
- Optional HR-ish lookups (positions, courses, pension, etc.) if later confirmed
- Material scope additions beyond the agreed epic set

---

## 5. Payment milestones

| Milestone | Trigger | % | Amount (₦) |
|---|---|---|---|
| **M1 — Mobilisation** | Quote acceptance / kickoff | 30% | 1,425,000 |
| **M2 — Platform & core API** | Auth, admin, engagements/requests/submissions/documents path demoable | 25% | 1,187,500 |
| **M3 — 🆕 + web MVP** | Partner reports, report-review cycle, dashboards/search wired; primary UI flows usable | 25% | 1,187,500 |
| **M4 — UAT & go-live** | UAT sign-off and production go-live | 20% | 950,000 |
| | **Total** | **100%** | **4,750,000** |

Amounts are fixed for the agreed scope. Change requests that expand scope are priced separately before work starts.

---

## 6. Change-order wording (for signature pack)

> **Change Order / Project Quote — abdcshare Full Product Replacement**  
>  
> The Client acknowledges that the prior Legacy ACA engagement valued at **₦5,000,000** is a **completed / prior engagement** and is **not credited** against this quote.  
>  
> This document is a **new fixed-price quote of ₦4,750,000** for full product replacement of the Client Collaboration / engagement platform, comprising backend API, background worker, and web application, including legacy capability parity and the new-product capabilities described herein (partner weekly reporting, final-report client review cycle, dashboards & analytics, phase-tagged engagements & supporting documents, global search, deadline reminders, and related collaboration upgrades).  
>  
> The commercial comparison to the prior ₦5,000,000 engagement is provided solely to demonstrate that the Client obtains a modern replacement **and** net-new product capability at a **lower** fixed price (**₦250,000** below the prior engagement).  
>  
> Items listed as out of scope require a separate written change order.

---

## 7. Acceptance

| Role | Name | Signature | Date |
|---|---|---|---|
| Client authorised signatory | | | |
| Vendor authorised signatory | | | |

---

## Appendix — One-page client snapshot

**Ask:** ₦4,750,000 fixed  
**Vs legacy:** ₦5,000,000 prior → **₦250,000 less**  
**You get:** Full replacement (API + worker + web) **+** partner weekly reports, client final-report review cycles, dashboards, smarter engagement workflow, search & reminders  
**You do not get (unless added):** Legacy data migration project, hosting fees, post-go-live retainer
