# Admin API Route Index

Generated from the mounted Express route declarations on 2026-10-06. Path values such as `:id` and `:role` are parameters. Admin support routes also have legacy aliases under `/api`; use the canonical `/api/admin` paths for admin operations.

Each handler defines its exact payload and response. GET routes use query filters and return resource or report data; write routes accept JSON and return the changed resource or a validation/conflict response. See [ADMIN_QA_REPORT.md](ADMIN_QA_REPORT.md) for the user-management payloads, curl examples, role behavior and runtime limits.

| Method | Canonical URL pattern | Router | Authorization guard |
|---|---|---|---|
| GET | `/api/admin/admin/dashboard` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/analytics` | `src/routes/adminSupportRoutes.js` | admin,store_manager,ict_officer,finance |
| GET | `/api/admin/analytics` | `src/routes/analyticsRoutes.js` | requireAdminAnalytics |
| GET | `/api/admin/analytics/assets` | `src/routes/analyticsRoutes.js` | requireAdminAnalytics |
| GET | `/api/admin/analytics/assignments` | `src/routes/analyticsRoutes.js` | requireAdminAnalytics |
| GET | `/api/admin/analytics/export` | `src/routes/analyticsRoutes.js` | requireAdminAnalytics |
| GET | `/api/admin/analytics/financial` | `src/routes/analyticsRoutes.js` | requireAdminAnalytics |
| GET | `/api/admin/analytics/inventory` | `src/routes/analyticsRoutes.js` | requireAdminAnalytics |
| GET | `/api/admin/analytics/maintenance` | `src/routes/analyticsRoutes.js` | requireAdminAnalytics |
| GET | `/api/admin/analytics/organizations` | `src/routes/analyticsRoutes.js` | requireAdminAnalytics |
| GET | `/api/admin/analytics/procurement` | `src/routes/analyticsRoutes.js` | requireAdminAnalytics |
| GET | `/api/admin/analytics/rfid` | `src/routes/analyticsRoutes.js` | requireAdminAnalytics |
| GET | `/api/admin/analytics/system` | `src/routes/analyticsRoutes.js` | requireAdminAnalytics |
| GET | `/api/admin/analytics/system/audit` | `src/routes/analyticsRoutes.js` | requireAdminAnalytics |
| GET | `/api/admin/analytics/system/authentication` | `src/routes/analyticsRoutes.js` | requireAdminAnalytics |
| GET | `/api/admin/analytics/system/data-quality` | `src/routes/analyticsRoutes.js` | requireAdminAnalytics |
| GET | `/api/admin/analytics/system/health` | `src/routes/analyticsRoutes.js` | requireAdminAnalytics |
| GET | `/api/admin/analytics/system/security` | `src/routes/analyticsRoutes.js` | requireAdminAnalytics |
| GET | `/api/admin/analytics/transfers` | `src/routes/analyticsRoutes.js` | requireAdminAnalytics |
| GET | `/api/admin/analytics/users` | `src/routes/analyticsRoutes.js` | requireAdminAnalytics |
| GET | `/api/admin/asset-categories` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| POST | `/api/admin/asset-categories` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| DELETE | `/api/admin/asset-categories/:id` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/asset-categories/:id` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| PATCH | `/api/admin/asset-categories/:id` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| PUT | `/api/admin/asset-categories/:id` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/assets` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/audit` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/audit-logs` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/audit-logs/export` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| POST | `/api/admin/audit/archive` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/audit/export` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/audit/retention` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/audit/stream` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/backups` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| POST | `/api/admin/backups` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| DELETE | `/api/admin/backups/:filename` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/backups/download/:filename` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| POST | `/api/admin/backups/restore/:filename` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/backups/stats` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/backups/verify/:filename` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/categories` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| POST | `/api/admin/categories` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| DELETE | `/api/admin/categories/:id` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/categories/:id` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| PATCH | `/api/admin/categories/:id` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| PUT | `/api/admin/categories/:id` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/colleges` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| POST | `/api/admin/colleges` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/colleges/:id` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| PUT | `/api/admin/colleges/:id` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/colleges/:id/dashboard` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| PATCH | `/api/admin/colleges/:id/status` | `src/routes/adminSupportRoutes.js` | admin,ict_officer,maintenance,college; admin,ict_officer,maintenance |
| GET | `/api/admin/colleges/export` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/colleges/manager-candidates` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/dashboard` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/departments` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| POST | `/api/admin/departments` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| DELETE | `/api/admin/departments/:id` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| PUT | `/api/admin/departments/:id` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/disposals` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| POST | `/api/admin/disposals` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/disposals/:id` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| POST | `/api/admin/disposals/:id/approve` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| POST | `/api/admin/disposals/:id/cancel` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| POST | `/api/admin/disposals/:id/execute` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/disposals/:id/history` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| POST | `/api/admin/disposals/:id/reject` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| POST | `/api/admin/disposals/:id/retire` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| POST | `/api/admin/disposals/:id/review` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| POST | `/api/admin/disposals/:id/schedule` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/integrations/enam` | `src/routes/enamRoutes.js` | app mount requires admin |
| PUT | `/api/admin/integrations/enam` | `src/routes/enamRoutes.js` | app mount requires admin |
| GET | `/api/admin/integrations/enam/conflicts` | `src/routes/enamRoutes.js` | app mount requires admin |
| GET | `/api/admin/integrations/enam/errors` | `src/routes/enamRoutes.js` | app mount requires admin |
| GET | `/api/admin/integrations/enam/health` | `src/routes/enamRoutes.js` | app mount requires admin |
| GET | `/api/admin/integrations/enam/logs` | `src/routes/enamRoutes.js` | app mount requires admin |
| GET | `/api/admin/integrations/enam/mappings` | `src/routes/enamRoutes.js` | app mount requires admin |
| POST | `/api/admin/integrations/enam/retry` | `src/routes/enamRoutes.js` | app mount requires admin |
| GET | `/api/admin/integrations/enam/status` | `src/routes/enamRoutes.js` | app mount requires admin |
| POST | `/api/admin/integrations/enam/sync` | `src/routes/enamRoutes.js` | app mount requires admin |
| GET | `/api/admin/integrations/enam/syncs` | `src/routes/enamRoutes.js` | app mount requires admin |
| POST | `/api/admin/integrations/enam/test` | `src/routes/enamRoutes.js` | app mount requires admin |
| GET | `/api/admin/inventory` | `src/routes/chemicalRoutes.js` | app mount requires admin |
| POST | `/api/admin/inventory` | `src/routes/chemicalRoutes.js` | admin,store_manager,maintenance |
| GET | `/api/admin/inventory/:id` | `src/routes/chemicalRoutes.js` | app mount requires admin |
| PUT | `/api/admin/inventory/:id` | `src/routes/chemicalRoutes.js` | admin,store_manager,maintenance |
| POST | `/api/admin/inventory/:id/adjust` | `src/routes/chemicalRoutes.js` | admin,store_manager,maintenance |
| POST | `/api/admin/inventory/:id/consume` | `src/routes/chemicalRoutes.js` | admin,store_manager,maintenance |
| GET | `/api/admin/inventory/:id/documents` | `src/routes/chemicalRoutes.js` | app mount requires admin |
| POST | `/api/admin/inventory/:id/documents` | `src/routes/chemicalRoutes.js` | admin,store_manager,maintenance |
| POST | `/api/admin/inventory/:id/quarantine` | `src/routes/chemicalRoutes.js` | admin,store_manager,maintenance |
| POST | `/api/admin/inventory/:id/restock` | `src/routes/chemicalRoutes.js` | admin,store_manager,maintenance |
| POST | `/api/admin/inventory/:id/transfer` | `src/routes/chemicalRoutes.js` | admin,store_manager,maintenance |
| GET | `/api/admin/inventory/quarantine` | `src/routes/chemicalRoutes.js` | app mount requires admin |
| GET | `/api/admin/inventory/scan/:identifier` | `src/routes/chemicalRoutes.js` | app mount requires admin |
| GET | `/api/admin/inventory/stock-orders` | `src/routes/chemicalRoutes.js` | app mount requires admin |
| POST | `/api/admin/inventory/stock-orders/:id/status` | `src/routes/chemicalRoutes.js` | admin,store_manager |
| GET | `/api/admin/inventory/transfers` | `src/routes/chemicalRoutes.js` | app mount requires admin |
| GET | `/api/admin/inventory/waste` | `src/routes/chemicalRoutes.js` | app mount requires admin |
| POST | `/api/admin/inventory/waste` | `src/routes/chemicalRoutes.js` | admin,store_manager,maintenance |
| PUT | `/api/admin/inventory/waste/:id` | `src/routes/chemicalRoutes.js` | admin,store_manager,maintenance |
| GET | `/api/admin/maintenance` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| POST | `/api/admin/maintenance` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| DELETE | `/api/admin/maintenance/:id` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/maintenance/:id` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| PUT | `/api/admin/maintenance/:id` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| PATCH | `/api/admin/maintenance/:id/approve` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| POST | `/api/admin/maintenance/:id/complete` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| POST | `/api/admin/maintenance/:id/reassign` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| PATCH | `/api/admin/maintenance/:id/reject` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| PATCH | `/api/admin/maintenance/:id/start` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| PATCH | `/api/admin/maintenance/:id/status` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/maintenance/costs` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| POST | `/api/admin/maintenance/costs` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| DELETE | `/api/admin/maintenance/costs/:id` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/maintenance/costs/:id` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| PATCH | `/api/admin/maintenance/costs/:id` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| PUT | `/api/admin/maintenance/costs/:id` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/maintenance/dashboard` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/maintenance/history` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/maintenance/scheduled` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| POST | `/api/admin/mfa/disable` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| POST | `/api/admin/mfa/regenerate-backup-codes` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| POST | `/api/admin/mfa/setup` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/mfa/status` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| POST | `/api/admin/mfa/verify` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/monitoring and /api/admin/system-monitoring/activity` | `src/routes/systemMonitoringRoutes.js` | requireAdmin |
| GET | `/api/admin/monitoring and /api/admin/system-monitoring/alerts` | `src/routes/systemMonitoringRoutes.js` | requireAdmin |
| POST | `/api/admin/monitoring and /api/admin/system-monitoring/alerts/:id/acknowledge` | `src/routes/systemMonitoringRoutes.js` | requireAdmin |
| POST | `/api/admin/monitoring and /api/admin/system-monitoring/alerts/:id/resolve` | `src/routes/systemMonitoringRoutes.js` | requireAdmin |
| GET | `/api/admin/monitoring and /api/admin/system-monitoring/errors` | `src/routes/systemMonitoringRoutes.js` | requireAdmin |
| GET | `/api/admin/monitoring and /api/admin/system-monitoring/export` | `src/routes/systemMonitoringRoutes.js` | requireAdmin |
| GET | `/api/admin/monitoring and /api/admin/system-monitoring/health` | `src/routes/systemMonitoringRoutes.js` | requireAdmin |
| GET | `/api/admin/monitoring and /api/admin/system-monitoring/history` | `src/routes/systemMonitoringRoutes.js` | requireAdmin |
| GET | `/api/admin/monitoring and /api/admin/system-monitoring/overview` | `src/routes/systemMonitoringRoutes.js` | requireAdmin |
| GET | `/api/admin/monitoring and /api/admin/system-monitoring/performance` | `src/routes/systemMonitoringRoutes.js` | requireAdmin |
| GET | `/api/admin/monitoring and /api/admin/system-monitoring/resources` | `src/routes/systemMonitoringRoutes.js` | requireAdmin |
| GET | `/api/admin/monitoring and /api/admin/system-monitoring/security` | `src/routes/systemMonitoringRoutes.js` | requireAdmin |
| GET | `/api/admin/monitoring and /api/admin/system-monitoring/services` | `src/routes/systemMonitoringRoutes.js` | requireAdmin |
| GET | `/api/admin/monitoring and /api/admin/system-monitoring/system-health` | `src/routes/systemMonitoringRoutes.js` | requireAdmin |
| GET | `/api/admin/notifications` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/notifications` | `src/routes/adminNotificationRoutes.js` | requireAdmin |
| POST | `/api/admin/notifications` | `src/routes/adminNotificationRoutes.js` | requireAdmin |
| DELETE | `/api/admin/notifications/:id` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/notifications/:id` | `src/routes/adminNotificationRoutes.js` | requireAdmin |
| PUT | `/api/admin/notifications/:id` | `src/routes/adminNotificationRoutes.js` | requireAdmin |
| PATCH | `/api/admin/notifications/:id/archive` | `src/routes/adminNotificationRoutes.js` | requireAdmin |
| POST | `/api/admin/notifications/:id/archive` | `src/routes/adminNotificationRoutes.js` | requireAdmin |
| PATCH | `/api/admin/notifications/:id/read` | `src/routes/adminNotificationRoutes.js` | requireAdmin |
| PUT | `/api/admin/notifications/:id/read` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| POST | `/api/admin/notifications/:id/retry` | `src/routes/adminNotificationRoutes.js` | requireAdmin |
| PATCH | `/api/admin/notifications/:id/unread` | `src/routes/adminNotificationRoutes.js` | requireAdmin |
| DELETE | `/api/admin/notifications/all` | `src/routes/adminSupportRoutes.js` | admin |
| POST | `/api/admin/notifications/bulk` | `src/routes/adminNotificationRoutes.js` | requireAdmin |
| PATCH | `/api/admin/notifications/read-all` | `src/routes/adminNotificationRoutes.js` | requireAdmin |
| PUT | `/api/admin/notifications/read-all` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/permissions` | `src/routes/adminRoleRoutes.js` | router permission guards |
| GET | `/api/admin/procurement` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/recovery` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/rfid/assets` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/rfid/assets` | `src/routes/adminRfidRoutes.js` | adminOnly |
| POST | `/api/admin/rfid/assets/:id/qr/regenerate` | `src/routes/adminRfidRoutes.js` | adminOnly |
| POST | `/api/admin/rfid/assets/:id/tags` | `src/routes/adminRfidRoutes.js` | adminOnly |
| GET | `/api/admin/rfid/assets/:id/tracking` | `src/routes/adminRfidRoutes.js` | adminOnly |
| GET | `/api/admin/rfid/lookup/asset-id/:assetId` | `src/routes/adminRfidRoutes.js` | adminOnly |
| GET | `/api/admin/rfid/lookup/code/:code` | `src/routes/adminRfidRoutes.js` | adminOnly |
| POST | `/api/admin/rfid/scan-log` | `src/routes/adminRfidRoutes.js` | adminOnly |
| GET | `/api/admin/rfid/scans` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/rfid/summary` | `src/routes/adminRfidRoutes.js` | adminOnly |
| POST | `/api/admin/rfid/tags` | `src/routes/adminSupportRoutes.js` | admin,ict_officer,store_manager |
| GET | `/api/admin/roles` | `src/routes/adminRoleRoutes.js` | router permission guards |
| POST | `/api/admin/roles` | `src/routes/adminRoleRoutes.js` | router permission guards |
| DELETE | `/api/admin/roles/:role` | `src/routes/adminRoleRoutes.js` | router permission guards |
| GET | `/api/admin/roles/:role` | `src/routes/adminRoleRoutes.js` | router permission guards |
| PUT | `/api/admin/roles/:role` | `src/routes/adminRoleRoutes.js` | router permission guards |
| GET | `/api/admin/roles/:role/permissions` | `src/routes/adminRoleRoutes.js` | router permission guards |
| PUT | `/api/admin/roles/:role/permissions` | `src/routes/adminRoleRoutes.js` | router permission guards |
| PATCH | `/api/admin/roles/:role/status` | `src/routes/adminRoleRoutes.js` | router permission guards |
| GET | `/api/admin/roles/:role/users` | `src/routes/adminRoleRoutes.js` | router permission guards |
| GET | `/api/admin/security/settings` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| PUT | `/api/admin/security/settings` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/settings` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/settings` | `src/routes/adminSettingsRoutes.js` | settings permission guards |
| PUT | `/api/admin/settings` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/settings/:section` | `src/routes/adminSettingsRoutes.js` | settings permission guards |
| PUT | `/api/admin/settings/:section` | `src/routes/adminSettingsRoutes.js` | settings permission guards |
| GET | `/api/admin/settings/profile` | `src/routes/adminSettingsRoutes.js` | settings permission guards |
| PUT | `/api/admin/settings/profile` | `src/routes/adminSettingsRoutes.js` | settings permission guards |
| POST | `/api/admin/settings/profile/change-password` | `src/routes/adminSettingsRoutes.js` | settings permission guards |
| POST | `/api/admin/settings/reset` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/settings/versions` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/settings/versions/:id` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| POST | `/api/admin/settings/versions/:id/restore` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/system/health` | `src/routes/adminSettingsRoutes.js` | settings permission guards |
| GET | `/api/admin/system/integrity` | `src/routes/adminSettingsRoutes.js` | settings permission guards |
| GET | `/api/admin/users` | `src/routes/userRoutes.js` | admin,college,store_manager,ict_officer,maintenance |
| GET | `/api/admin/users` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| POST | `/api/admin/users` | `src/routes/userRoutes.js` | admin |
| POST | `/api/admin/users` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| DELETE | `/api/admin/users/:id` | `src/routes/userRoutes.js` | admin |
| GET | `/api/admin/users/:id` | `src/routes/userRoutes.js` | admin,college,store_manager,ict_officer,maintenance |
| GET | `/api/admin/users/:id` | `src/routes/adminSupportRoutes.js` | admin,college,store_manager,ict_officer,maintenance |
| PUT | `/api/admin/users/:id` | `src/routes/userRoutes.js` | admin |
| PUT | `/api/admin/users/:id` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/users/:id/activity` | `src/routes/userRoutes.js` | admin |
| GET | `/api/admin/users/:id/activity` | `src/routes/adminSupportRoutes.js` | admin |
| POST | `/api/admin/users/:id/force-password-change` | `src/routes/userRoutes.js` | admin |
| POST | `/api/admin/users/:id/lock` | `src/routes/userRoutes.js` | admin |
| POST | `/api/admin/users/:id/lock` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| POST | `/api/admin/users/:id/reset-password` | `src/routes/userRoutes.js` | admin |
| POST | `/api/admin/users/:id/reset-password` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| PATCH | `/api/admin/users/:id/status` | `src/routes/userRoutes.js` | admin |
| PATCH | `/api/admin/users/:id/status` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| POST | `/api/admin/users/:id/terminate-session` | `src/routes/userRoutes.js` | admin |
| POST | `/api/admin/users/:id/unlock` | `src/routes/userRoutes.js` | admin |
| POST | `/api/admin/users/:id/unlock` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/users/activity` | `src/routes/userRoutes.js` | admin |
| GET | `/api/admin/users/profile` | `src/routes/userRoutes.js` | Admin mount guard |
| PUT | `/api/admin/users/profile` | `src/routes/userRoutes.js` | Admin mount guard |
| DELETE | `/api/admin/users/profile/photo` | `src/routes/userRoutes.js` | Admin mount guard |
| POST | `/api/admin/users/profile/photo` | `src/routes/userRoutes.js` | Admin mount guard |
| GET | `/api/admin/users/roles` | `src/routes/userRoutes.js` | admin |
| GET | `/api/admin/users/stats` | `src/routes/userRoutes.js` | admin |
| GET | `/api/admin/users/stats` | `src/routes/adminSupportRoutes.js` | requireAuth + requireRole(admin) mount |
| GET | `/api/admin/users/technicians` | `src/routes/userRoutes.js` | admin,maintenance,ict_officer |
| GET | `/api/colleges/:id/departments` | `src/routes/userManagementOptionsRoutes.js` | adminOnly on routes |
| GET | `/api/roles` | `src/routes/userManagementOptionsRoutes.js` | adminOnly on routes |

Total indexed declarations: 228. Route arrays defining aliases appear as separate rows. Admin support routes mounted through both /api/admin and /api are represented here by the canonical admin prefix.
