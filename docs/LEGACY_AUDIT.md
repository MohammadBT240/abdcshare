# abdcshare — Legacy ACA Schema (ground-truth extraction)

> Auto-extracted from `aca.sql`. **66 tables, 351 columns.** This is the
> field-level ground truth the new ERD must cover (restructured, not dropped).


## Reference / lookups (global_*)

### `field_studied` (1 cols)
sn

### `global_banks` (1 cols)
id

### `global_category` (0 cols)


### `global_client_type` (1 cols)
created_at

### `global_courses` (2 cols)
sn, course

### `global_gender` (0 cols)


### `global_industry` (0 cols)


### `global_lga` (0 cols)


### `global_marital_status` (0 cols)


### `global_pension` (8 cols)
id, accountname, accountno, bankname, employercode, sortcode, pensionname, pfacode

### `global_request_status` (3 cols)
id, status, created_at

### `global_state` (0 cols)


### `global_status` (0 cols)


### `global_title` (0 cols)


### `global_ward` (0 cols)


### `positions` (4 cols)
id, catid, subid, rank

### `settings` (6 cols)
invoice_no, id, company, address, tel, website


## Identity & access

### `password_reset_tokens` (8 cols)
id, user_id, email, url_token, verification_code, expires_at, used, created_at

### `users_access` (0 cols)


### `users_details` (24 cols)
id, title, first_name, middle_name, surname, company_name, company_registered_address, incorporation_date, incorporation_no, email, phone_number, alternative_phone_number, gender, official_address, residential_address, profile_avatar, password, must_change_password, created_at, created_by, record_id, update_record_id, updated_at, updated_by

### `users_roles` (0 cols)



## Requests

### `assigned_auditors` (4 cols)
id, request_id, added_by, created_at

### `client_response` (6 cols)
id, response_id, request_id, client_id, description, created_at

### `client_response_sub` (8 cols)
id, response_id, file_name, status, created_at, updated_by, update_record_id, updated_at

### `request` (5 cols)
id, request_id, request_description, module, created_at

### `request_client` (12 cols)
id, request_id, client_id, request_type, request_stage, request_description, request_status, created_by, created_at, due_date, updated_by, updated_at

### `request_client_sub` (6 cols)
id, request_id, file_name, record_id, created_by, created_at

### `request_stage` (3 cols)
id, stage, created_at

### `request_type` (8 cols)
id, request_type, documents_no, created_at, created_by, record_id, updated_at, updated_by

### `requesthistory` (5 cols)
id, request_id, request_description, module, created_at

### `reviews` (7 cols)
id, document_id, request_id, document_status, description, sent_from, created_at


## Working papers

### `advisory_working_paper` (8 cols)
id, paper_id, client_id, paper_title, paper_description, created_by, created_date, created_at

### `advisory_working_paper_files` (5 cols)
id, paper_id, file_name, created_by, created_at

### `audit_working_paper` (8 cols)
id, paper_id, client_id, paper_title, paper_description, created_by, created_date, created_at

### `audit_working_paper_files` (5 cols)
id, paper_id, file_name, created_by, created_at

### `business_working_paper` (8 cols)
id, paper_id, client_id, paper_title, paper_description, created_by, created_date, created_at

### `business_working_paper_files` (5 cols)
id, paper_id, file_name, created_by, created_at

### `other_working_paper` (8 cols)
id, paper_id, client_id, paper_title, paper_description, created_by, created_date, created_at

### `other_working_paper_files` (5 cols)
id, paper_id, file_name, created_by, created_at

### `shared_working_paper` (8 cols)
id, paper_id, client_id, paper_title, paper_description, created_by, created_date, created_at

### `shared_working_paper_files` (5 cols)
id, paper_id, file_name, created_by, created_at

### `tax_working_paper` (8 cols)
id, paper_id, client_id, paper_title, paper_description, created_by, created_date, created_at

### `tax_working_paper_files` (5 cols)
id, paper_id, file_name, created_by, created_at


## Final reports

### `advisory_final_report_advisors` (4 cols)
id, report_id, added_by, created_at

### `advisory_final_report_files` (5 cols)
id, report_id, file_name, created_by, created_at

### `advisory_final_reports` (8 cols)
id, report_id, client_id, report_title, report_description, created_by, created_date, created_at

### `assurance_final_report_auditors` (4 cols)
id, report_id, added_by, created_at

### `assurance_final_report_files` (5 cols)
id, report_id, file_name, created_by, created_at

### `assurance_final_reports` (8 cols)
id, report_id, client_id, report_title, report_description, created_date, created_by, created_at

### `business_final_report_files` (5 cols)
id, report_id, file_name, created_by, created_at

### `business_final_report_staffs` (4 cols)
id, report_id, added_by, created_at

### `business_final_reports` (8 cols)
id, report_id, client_id, report_title, report_description, created_by, created_date, created_at

### `other_final_report_files` (5 cols)
id, report_id, file_name, created_by, created_at

### `other_final_report_staffs` (4 cols)
id, report_id, added_by, created_at

### `other_final_reports` (8 cols)
id, report_id, client_id, report_title, report_description, created_date, created_by, created_at

### `shared_final_report_files` (5 cols)
id, report_id, file_name, created_by, created_at

### `shared_final_report_staffs` (4 cols)
id, report_id, added_by, created_at

### `shared_final_reports` (8 cols)
id, report_id, client_id, report_title, report_description, created_by, created_date, created_at

### `tax_final_report_files` (5 cols)
id, report_id, file_name, created_by, created_at

### `tax_final_report_staffs` (4 cols)
id, report_id, added_by, created_at

### `tax_final_reports` (8 cols)
id, report_id, client_id, report_title, report_description, created_date, created_by, created_at


## Company / notifications / audit / email

### `activity_log` (4 cols)
id, description, record_id, time

### `company_profiles` (13 cols)
id, profile_id, title, description, file_name, file_url, file_size, file_type, created_by, record_id, created_at, updated_at, status

### `email_queue` (12 cols)
id, queue_id, to_email, to_name, subject, body, status, attempts, max_attempts, error_message, sent_at, created_at

### `notification_preferences` (7 cols)
id, user_id, notification_type, email_enabled, in_app_enabled, created_at, updated_at

### `notifications` (13 cols)
id, notification_id, user_id, type, title, message, related_id, related_type, is_read, read_at, email_sent, email_sent_at, created_at

---

# Legacy feature / endpoint inventory (ground truth for user stories)

**Totals:** 23 conn.php write actions · 49 fetch endpoints · 17 delete endpoints · 4 setters · 5 getters · 4 services.

## conn.php write actions ($_POST['submitButton'])
- add-request-type
- advisory-final-report
- advisory-working-paper
- assurance-final-report
- audit-working-paper
- business-final-report
- business-working-paper
- client-response
- create-user
- other-final-report
- other-working-paper
- profile-request
- request-client
- shared-final-report
- shared-working-paper
- tax-final-report
- tax-working-paper
- update-auditors
- update-request-stage
- update-request-status
- update-request-type
- update-response-document-status
- update-user-access

## fetch endpoints (reads, lists, analytics, exports, bulk import)
- download_bulk_users_template.php
- download_response_files.php
- export_advisory_final_reports.php
- export_advisory_working_papers.php
- export_assurance_final_reports.php
- export_audit_working_papers.php
- export_business_final_reports.php
- export_business_working_papers.php
- export_other_final_reports.php
- export_other_working_papers.php
- export_shared_final_reports.php
- export_shared_working_papers.php
- export_tax_final_reports.php
- export_tax_working_papers.php
- fetch_accounts-report.php
- fetch_advisory_final_reports.php
- fetch_advisory_final_reports_analytics.php
- fetch_advisory_working_papers-report.php
- fetch_advisory_working_papers_analytics.php
- fetch_assurance_final_reports.php
- fetch_assurance_final_reports_analytics.php
- fetch_audit_working_papers-report.php
- fetch_audit_working_papers_analytics.php
- fetch_business_final_reports.php
- fetch_business_final_reports_analytics.php
- fetch_business_working_papers-report.php
- fetch_business_working_papers_analytics.php
- fetch_clientRequest-report.php
- fetch_client_response_documents.php
- fetch_company_profiles.php
- fetch_other_final_reports.php
- fetch_other_final_reports_analytics.php
- fetch_other_working_papers-report.php
- fetch_other_working_papers_analytics.php
- fetch_request_type-report.php
- fetch_requests-report.php
- fetch_reviews.php
- fetch_shared_final_reports.php
- fetch_shared_final_reports_analytics.php
- fetch_shared_working_papers-report.php
- fetch_shared_working_papers_analytics.php
- fetch_tax_final_reports.php
- fetch_tax_final_reports_analytics.php
- fetch_tax_working_papers-report.php
- fetch_tax_working_papers_analytics.php
- import_bulk_users.php
- notify_response_submitted.php
- preview_bulk_users.php
- view_email_logs.php

## delete endpoints (incl. bulk deletes)
- bulk_delete_audit_papers.php
- delete_accounts-record.php
- delete_advisory_final_report.php
- delete_advisory_paper.php
- delete_assurance_final_report.php
- delete_audit_paper.php
- delete_business_final_report.php
- delete_business_paper.php
- delete_client_request-record.php
- delete_other_final_report.php
- delete_other_paper.php
- delete_request-record.php
- delete_request-type-record.php
- delete_shared_final_report.php
- delete_shared_paper.php
- delete_tax_final_report.php
- delete_tax_paper.php

## setters / getters
- setter: create_notification.php
- setter: set-company-profile.php
- setter: set-response-document-status.php
- setter: set-review.php
- getter: getRequestsAndResponses.php
- getter: get_cities.php
- getter: get_clients_request_chart.php
- getter: get_states.php
- getter: get_wards.php

## services
- BulkUserImportParser.php
- BulkUserRowValidator.php
- UserAccountService.php
- bootstrap.php

## Notable capabilities that MUST carry to the new build (were missed in v1 docs)
- **Bulk user import**: template download → CSV/Excel upload → preview → row validation → import (download_bulk_users_template, preview_bulk_users, import_bulk_users + BulkUserImportParser, BulkUserRowValidator, UserAccountService).
- **Exports**: CSV/Excel export on every working-paper and final-report line (13 export endpoints).
- **Bulk delete** (e.g. bulk_delete_audit_papers) across document lists.
- **Rich user/client profile**: title, first/middle/surname, gender, marital status, two phone numbers, official/residential/registered addresses, avatar, company incorporation date/no, bank, pension, position, field studied (via global_* lookups).
- **Reference data**: 14 global_* lookup tables (banks, category, client type, courses, gender, industry, LGA, marital status, pension, request status, state, status, title, ward).
- **users_access**: per-user access/permission table (finer-grained than role alone).
- **email_queue**: queued email delivery table (maps to our outbox/worker).
- **requesthistory / reviews / assigned_auditors**: request audit trail, review records, auditor assignment.
