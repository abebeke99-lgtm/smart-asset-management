# Department Head API

All endpoints are mounted under `/api/department-head`. Send the JWT as
`Authorization: Bearer <token>`. The account must have the `department_head`
role and an active department association. The API resolves the department
from the authenticated user; caller-supplied department IDs never widen scope.
Protected routes return `401` for missing/invalid credentials, `403` for a
missing department scope or insufficient permission, and `404` for records
outside the caller's department.

## Endpoints

| Path | Methods | Purpose |
|---|---|---|
| `/profile` | GET, PUT | Department profile (limited to permitted profile fields) |
| `/dashboard` | GET | Department KPIs and chart series |
| `/dashboard/kpis` | GET | Department KPI summary |
| `/dashboard/asset-status` | GET | Asset-status chart series |
| `/dashboard/asset-categories` | GET | Asset-category chart series |
| `/dashboard/service-status` | GET | Service-request status chart series |
| `/dashboard/request-status` | GET | Acquisition-request status chart series |
| `/dashboard/recent-activities` | GET | Recent department activity rows |
| `/analytics` | GET | Asset utilization/condition, inventory, approvals, service, and ticket-aging analytics |
| `/analytics/assets`, `/analytics/inventory`, `/analytics/approvals`, `/analytics/service`, `/analytics/ticket-aging` | GET | Analytics route aliases returning the department analytics payload |
| `/staff` | GET | Read-only department staff directory |
| `/locations` | GET | Department locations; `?export=true` requires export permission |
| `/locations/:recordType/:locationId/assets` | GET | Assets at a department location |
| `/laboratories` | GET | Department laboratory list and summary |
| `/laboratories/:id` | GET | Laboratory detail and scoped inventory |
| `/assets` | GET | Department assets |
| `/inventory` | GET | Filterable department inventory |
| `/requests` | GET, POST; `/:id` GET | General department requests |
| `/asset-requests` | GET, POST; `/:id` GET | Acquisition requests; `/:id/submit` POST submits a draft |
| `/approvals` | GET; `/:id` GET | Approval queue and review detail |
| `/approvals/:id/approve` | POST | Approve an acquisition request |
| `/approvals/:id/reject` | POST | Reject an acquisition request |
| `/approvals/:id/request-changes` | POST | Return a request for changes |
| `/approvals/:id/escalate` | POST | Escalate to the college manager |
| `/assignments` | GET, POST; `/history` GET | Department asset assignments and history |
| `/transfers` | GET, POST; `/:id` GET | Department transfer requests |
| `/transfers/:id/cancel` | POST | Cancel a transfer |
| `/transfers/:id/receive` | POST | Confirm receipt of a transfer |
| `/returns` | GET, POST; `/:id` GET | Asset returns |
| `/returns/:id/cancel` | POST | Cancel a return |
| `/verification` | GET, POST; `/:id` GET | Verification sessions |
| `/verification/:id/items` | POST | Add an item to a verification |
| `/verification/:id/submit` | POST | Submit a verification |
| `/verification/:id/finalize` | POST | Finalize a verification |
| `/verification/history` | GET; `/verification/records` POST | Physical verification records |
| `/tracking/:id/verify-location` | POST | Compare an observed asset location with its registered location |
| `/tracking/:id/verify-assignment` | POST | Compare an observed assignee with the active department assignment |
| `/service-requests` | GET, POST; `/:id` GET | Routed service requests and detail |
| `/service-requests/:id/acknowledge` | POST | Acknowledge a service request |
| `/service-requests/:id/assign` | POST | Assign a technician (permission-checked) |
| `/maintenance` | GET, POST; `/:id` GET | Maintenance oversight and requests |
| `/maintenance/:id/cancel` | POST | Cancel a maintenance request |
| `/history` | GET | Department activity history |
| `/asset-history` | GET | Department asset history |
| `/tickets` | GET; `/:id` GET | Ticket monitoring and detail |
| `/escalated-tickets` | GET | Escalated tickets and follow-up history |
| `/tickets/:id/follow-up` | POST | Add a follow-up to an escalated ticket |
| `/tracking/scan/:identifier` | GET | QR/RFID, asset code, serial number, or ID lookup |
| `/tracking/:id/location` | GET | Scoped current location |
| `/tracking/:id/assignments` | GET | Scoped assignment history |
| `/tracking/:id/transfers` | GET | Scoped transfer history |
| `/tracking/:id/maintenance` | GET | Scoped maintenance history |
| `/reports` | GET | Department report; choose a supported `reportType` |
| `/reports/assets` | GET | Asset report |
| `/reports/maintenance` | GET | Maintenance report |
| `/reports/inventory` | GET | Inventory report |
| `/reports/assignments` | GET | Department asset assignment report |
| `/reports/transfers` | GET | Transfers where the department is the source or destination |
| `/reports/verification` | GET | Physical verification results and discrepancies |
| `/reports/escalations` | GET | Escalated service-request report |
| `/notifications` | GET | Visible user/role/department notifications |
| `/notifications` | POST | Send an in-app notification to active department staff; optionally provide `userIds` |
| `/notifications/:id` | GET | Notification detail |
| `/notifications/:id/read` | PATCH, PUT | Mark a visible notification read |
| `/notifications/read-all` | PATCH, PUT | Mark visible notifications read |

List endpoints accept their documented page, limit, search, and status filters.
The server clamps page sizes and applies the authenticated department scope in
the database query. Responses use `{ success, data, ... }`; paginated resources
include `total` and `pagination`.

The dashboard endpoints return `{ success: true, data }`. KPI `data` includes
`totalAssets`, `activeAssets`, `damagedAssets`, `underMaintenance`,
`availableAssets`, `assignedAssets`, `pendingAcquisitionRequests`,
`pendingApprovals`, `openServiceRequests`, `overdueTickets`,
`escalatedTickets`, and `laboratories`; `pendingRequests` is retained as an
alias for `pendingAcquisitionRequests`, and `availableInventory` is an alias
for `availableAssets`. The chart and recent-activity endpoints
return the corresponding arrays from `/dashboard`. The combined `/dashboard`
endpoint is available to clients that need all sections in one request.
The combined response includes up to 12 newest activity rows. The dashboard
activity table provides client-side search, action/status filters, sorting, and
five-row pagination over those returned rows; use `/history` for paginated
department-wide activity history.

Analytics and report endpoints accept optional `dateFrom` and `dateTo` values
in `YYYY-MM-DD` format. Report endpoints additionally accept `page` (default 1),
`limit` (default 50, maximum 100), `search`, and `status`; invalid supplied page
or limit values return `400`. Notification creation requires the
`department_head.notifications.create` permission. Omitted `userIds` targets
active staff in the authenticated department; supplied IDs are validated
against that same department, and foreign or inactive recipients are rejected.
Tracking verification routes first require the asset to belong to the resolved
department.

## Workflow and audit behavior

- Acquisition requests progress from draft/submission to department-head
  approval, rejection, requested changes, or escalation to the college manager.
- Service requests route automatically to the appropriate support team. Open
  submissions are escalated after 72 hours without acknowledgement; escalation
  status history, audit history, and authority notifications are recorded.
- Creating a normal (low/medium priority) service request is rejected with
  `409` when the department already has more than 10 open, unacknowledged
  service requests. High and critical requests remain available. A department
  row lock serializes the count-and-create check to prevent concurrent requests
  from bypassing the threshold.
- Critical request creation and automatic escalation are written to `audit_logs`.
  Other workflow mutations use the existing audit trail in their controllers.

## Database migration

Apply
`backend/database/migrations/20261007_department_head_service_request_laboratory.sql`
to the configured MySQL database. It safely adds the nullable `laboratory_id`
reference and index to `service_requests`, backfills laboratory IDs from linked
assets, and references the existing department-scoped laboratory records in
`rooms`.
