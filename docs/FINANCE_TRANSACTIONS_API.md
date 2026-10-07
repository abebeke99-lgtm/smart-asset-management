# Finance Transactions API

All endpoints are mounted under `/api/finance/transactions` and require a valid JWT plus the `admin` or `finance` role.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/finance/transactions` | List, filter, search, paginate, and summarize transactions |
| `GET` | `/api/finance/transactions/:id` | Retrieve one transaction |
| `POST` | `/api/finance/transactions` | Create a transaction |
| `PUT` | `/api/finance/transactions/:id` | Update supplied transaction fields |
| `DELETE` | `/api/finance/transactions/:id` | Soft-delete a transaction |

The list accepts `page`, `pageSize` (maximum 100), `search`, `transactionType`, `referenceType`, `status`, `dateFrom`, and `dateTo`. Date filters use `YYYY-MM-DD`; `dateFrom` must not be later than `dateTo`.

Create requires `transactionNumber`, `transactionDate`, and at least one positive value among `amount`, `debit`, and `credit`. Supported transaction types are `Payment`, `Receipt`, `Purchase`, `Sale`, `Adjustment`, `Transfer`, `Journal`, and `Other`. Status values are `Draft`, `Pending`, `Posted`, `Processing`, `Completed`, `Failed`, and `Cancelled`. Currency is a three-letter code. The API records creator/updater/deleter IDs from the authenticated user, never from request data.

Successful list responses include `data`, `transactions` (compatibility alias), `summary`, and `pagination`. Create returns HTTP `201`; invalid input returns `422`; duplicate transaction numbers return `409`; missing records return `404`; unauthenticated and disallowed roles receive `401` and `403`.

## Database setup

Apply `backend/database/migrations/20261007_finance_transactions.sql` to an existing MySQL database before deploying this API. The application also registers the Sequelize model so its missing-table initialization can create the table in installations using that startup mechanism. Soft-deleted entries retain their record and deletion actor, and are excluded from normal queries.
