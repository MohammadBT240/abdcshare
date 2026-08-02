# Notifications — recipient matrix

In-app + email fan-out uses `NotificationsService.emit` in the API. The worker only sends
`notification.email` batches (`GenericNotificationEmail`). Actor is always excluded via
`excludeUserId`. Defaults: both channels on when no preference row exists.

| Event `type` | Recipients | Notes |
|---|---|---|
| `engagement.created` | Initial team (if any) | Creating SA excluded as actor |
| `engagement.stage_changed` | Engagement team | |
| `engagement.team_changed` | Added/removed user + remaining team | |
| `engagement.class_changed` | Engagement team | |
| `engagement.signoff` / `engagement.signoff_revoked` | Engagement team | Class or engagement-wide |
| `request.created` | Team when **no** assignees | With assignees → only `request.assigned` (no double mail) |
| `request.assigned` | New assignee | |
| `request.unassigned` | Removed assignee | |
| `request.updated` / `request.stage_changed` / `request.status_changed` | Assignees if any; else team | |
| `request.deadline` / `request.overdue` | Assignees | Cron reminders |
| `document.uploaded` / `document.status_changed` | Engagement team | Final-report client cycle uses existing report.* types |
| `discussion.message` | Team + assignees + client primary + mentions | Existing |
| `submission.created` | Engagement team | Existing |
| `submission.reviewed` | Submitter | Existing |
| `review.*` / `report.*` / `partner-report.*` | See existing call sites | Unchanged |

**Not notified by default:** Platform Admin; Super Admin unless on the team or actor; client primary contact for internal firm events.

Catalog: `@abdcshare/shared` → `NOTIFICATION_TYPES` / `NOTIFICATION_TYPE_CATALOG`.
