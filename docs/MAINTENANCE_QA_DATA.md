# Maintenance QA Data

The local end-to-end maintenance QA utility reuses the existing Sequelize models and tables. It does not create or alter schema.

From `backend`, inspect before writing, seed the uniquely tagged QA asset and active QA technician, then remove the QA asset and maintenance records created against it when finished:

```powershell
node src/scripts/maintenanceQaData.js --inspect
node src/scripts/maintenanceQaData.js --seed
node src/scripts/maintenanceQaData.js --cleanup
```

The utility refuses to run when `NODE_ENV=production`. The asset uses digital ID and asset code `QA-MAINT-2026-001`; the technician username is `qa_maintenance_technician`. Existing records with these identifiers are validated rather than overwritten. The technician receives a random password hash and is intended only as an assignment target, not a login account. Cleanup removes maintenance records linked to the tagged asset and removes the technician only when maintenance assignments have been cleared.

Maintenance requests, work orders, preventive schedules, parts, vendors, costs, tests, and QC records should be created through the application/API during QA so their business workflows are exercised rather than pre-populated around them.

## Technician deactivation and browser QA login

`qa_maintenance_technician` is a historical assignment identity. Keep its user and linked maintenance records. Inspect the planned deactivation before any write:

```powershell
node src/scripts/deactivateQaMaintenanceTechnician.js --dry-run
```

This reports references and plans to disable login, replace the password hash, increment the session version, clear reset tokens, and append an immutable audit marker. The script never deletes or rewrites historical requests, work orders, repairs, or history. `--apply` is a separate local/staging-only operation and must not be run without explicit approval. Dry-run is allowed in production; apply is blocked there.

For an independent browser login, inspect and create the temporary account with the password supplied only in the local process environment:

```powershell
node src/scripts/maintenanceQaLogin.js --inspect
$env:QA_MAINTENANCE_PASSWORD = '<local-only value, at least 12 characters>'
node src/scripts/maintenanceQaLogin.js --create
```

The QA login utility refuses production, stores a bcrypt hash, and never prints the password. Deactivate the temporary login after browser QA:

```powershell
node src/scripts/maintenanceQaLogin.js --deactivate
```

Maintenance cost entry now stores Labor, Parts, Materials, and Other as categorized `maintenance_costs` linked to the repair. Its total is computed by the backend. Read-only SQL reconciliation and rollback/notification persistence tests are opt-in with `MAINTENANCE_READONLY_INTEGRATION=1` and `MAINTENANCE_INTEGRATION_DB=1` respectively; run them only against local/staging data.