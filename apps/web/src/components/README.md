# Shared UI kit

Layered components for uniform UX across the app.

| Layer | Path | Use for |
|---|---|---|
| Primitives | `components/ui/` | Button, Input, Select, Calendar, Dialog… |
| Forms | `components/forms/` | AppSelect, DatePicker, DateRangePicker, FileUpload, FormDialog… |
| Data | `components/data/` | DataTable, EntityCell, StatusBadge, RowActions, snColumn… |

**Report column recipe:** `snColumn(page, pageSize)` + `EntityCell` + `StatusBadge` + `RowActions`.

Prefer `FilterBar` outside `DataTable` for list pages. Features must not import `react-day-picker` or `cmdk` directly.

**Uploads:** Avatars stay small (2 MB, base64 via API). Documents / company profiles use multipart (`bffFormData`) up to `DOCUMENT_MAX_BYTES` (100 MB) — never send large binaries as JSON.
