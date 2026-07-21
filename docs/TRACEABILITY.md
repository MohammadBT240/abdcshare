# Quantum — ACA → Quantum Traceability Matrix

> Confirms feature parity: every significant legacy ACA capability maps to a Quantum user story.
> Used to verify nothing from the old app is silently dropped in the rebuild.

## Legacy write actions (`conn.php` `submitButton`) → Quantum stories

| Legacy action | Quantum story |
|---------------|---------------|
| `create-user` | Q-B-1 |
| `update-user-access` | Q-B-2 |
| `request-client` | Q-F-1 (now inside an engagement) |
| `update-request-status` | Q-F-2 |
| `update-request-stage` | Q-F-2 |
| `update-auditors` | Q-F-3 |
| `client-response` | Q-H-2 |
| `update-response-document-status` | Q-H-3 |
| `add-request-type` | Q-C-2 |
| `update-request-type` | Q-C-2 |
| `audit-working-paper` | Q-G-1 |
| `advisory-working-paper` | Q-G-1 |
| `business-working-paper` | Q-G-1 |
| `tax-working-paper` | Q-G-1 |
| `other-working-paper` | Q-G-1 |
| `shared-working-paper` | Q-G-1 |
| `assurance-final-report` | Q-G-2 |
| `advisory-final-report` | Q-G-2 |
| `business-final-report` | Q-G-2 |
| `tax-final-report` | Q-G-2 |
| `shared-final-report` | Q-G-2 |
| `other-final-report` | Q-G-2 |
| `profile-request` | Q-A-7 |

## Legacy pages / features → Quantum coverage

| Legacy page / feature | Quantum story |
|-----------------------|---------------|
| Login / forgot / reset / change password | Q-A-1..A-5 |
| Forced first-login password change | Q-A-2 |
| Create-User / User-Update | Q-B-1, Q-B-2 |
| Users-Report (SA read-only) | Q-B-5, Q-B-6 |
| Utilities (request types, stages, statuses) | Q-C-2, Q-C-4 |
| Company-Profile | Q-O-1, Q-O-2 |
| Client requests + stages/statuses | Epic F |
| Request discussion + read-tracking | Q-I-1, Q-I-2 |
| Working papers (6 service lines) | Q-G-1 (now by request class) |
| Final reports (6 service lines) | Q-G-2 (now by request class) |
| Secure downloads / PDF viewer (R2/local) | Q-G-3 |
| Zip exports | Q-G-5, Q-M-3 |
| Client-Overview / client response docs | Epic H |
| Notifications + email preferences | Epic L |
| Activity log | Epic N |
| Role-based page access (5 roles) | Enforced across all epics |

## RBAC consistency check

| Legacy rule | Preserved in Quantum |
|-------------|----------------------|
| Governance writes = Platform Admin only | Q-B-*, Q-C-1..C-4, Q-D-*, Q-O-1 |
| Super Admin = operations + read-only governance | Q-B-5, Q-C-5, Q-O-2 |
| At least one Platform Admin must exist | Q-B-3 |
| Staff = library only, no request admin | Epic G access; excluded from Epic E/F admin |
| Client = own requests/responses only | Q-E-8, Epic H |
| Server-side page/permission enforcement (no SA bypass) | Assumed baseline for all stories |

## Verification result

- **Parity:** All 23 legacy write actions and all major pages map to a story. One gap found during
  review (profile/avatar update) and added as **Q-A-7**.
- **Restructure:** Working papers, final reports, requests, and reports are re-grouped by **request class
  within an engagement**; the six former service lines become **departments**.
- **RBAC:** No contradictions with the legacy role model; the 5 roles and governance/operations split
  are preserved.
- **New scope** (Engagements, review workflow, dashboards, versioning, search, reminders) is additive
  and flagged 🆕 for approval in USER_STORIES.md.
