# ICT Inventory Import

ICT inventory is available to users with `ict.inventory.view`. Spreadsheet import
requires `ict.inventory.import`.

Use **Download import template** on `/ict/inventory` for the approved CSV header
row. CSV, XLS, and XLSX files up to 10 MB and 2,000 data rows are accepted.

| Column | Required | Validation |
| --- | --- | --- |
| Asset ID | No | Must be unique when supplied. |
| Asset Name | Yes | 255 characters or fewer. |
| Category | Yes | Must match an active asset category. |
| Serial Number | No | Must be unique when supplied. |
| Department | Yes | Must match a department available in the user's college scope. |
| Status | No | Must be a supported asset status; defaults to `available`. |
| Condition | No | Defaults to `Good`. |
| Location | Yes | 255 characters or fewer. |
| Campus, College | No | When supplied, must match the department's organization scope. |
| Description, Manufacturer, Model, Supplier | No | Optional asset details. |
| Purchase Date, Expiry Date, Warranty Expiry | No | Use `YYYY-MM-DD` or `MM/DD/YY(YY)`. |
| Purchase Price | No | Must be a non-negative number. |
| Quantity | No | Must be a positive integer; defaults to `1`. |

The server validates the selected spreadsheet and presents a row-level preview
before saving. Rows with validation errors or duplicate asset IDs/serial numbers
are rejected. Valid, non-duplicate rows and the import audit entry are written
in one database transaction; a failed write rolls the transaction back. The
preview and result report show total rows, imported, rejected, duplicates, and
validation-error counts.
