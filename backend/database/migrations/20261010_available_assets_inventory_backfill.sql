-- 20261010_available_assets_inventory_backfill.sql
-- Backfills the inventory ledger for existing assets that do not yet have an
-- inventory record. Availability is derived from the asset status so the Store
-- "Available Assets" workflow reflects the real asset ledger:
--   available status        -> available_quantity = quantity
--   reserved status         -> reserved_quantity  = quantity
--   damaged status          -> damaged_quantity   = quantity
--   any other status        -> no available stock
-- Idempotent: only inserts rows for assets without an inventory record.
-- Run against smart_asset_db (e.g. mysql -u root smart_asset_db < this file).

INSERT INTO inventory (
  asset_id,
  department_id,
  quantity,
  available_quantity,
  reserved_quantity,
  damaged_quantity,
  minimum_quantity,
  location,
  status,
  created_at,
  updated_at
)
SELECT
  a.id,
  a.department_id,
  GREATEST(COALESCE(a.quantity, 1), 1) AS quantity,
  CASE
    WHEN LOWER(TRIM(a.status)) IN ('available', 'in_store', 'active')
      THEN GREATEST(COALESCE(a.quantity, 1), 1)
    ELSE 0
  END AS available_quantity,
  CASE
    WHEN LOWER(TRIM(a.status)) = 'reserved'
      THEN GREATEST(COALESCE(a.quantity, 1), 1)
    ELSE 0
  END AS reserved_quantity,
  CASE
    WHEN LOWER(TRIM(a.status)) = 'damaged'
      THEN GREATEST(COALESCE(a.quantity, 1), 1)
    ELSE 0
  END AS damaged_quantity,
  0 AS minimum_quantity,
  COALESCE(a.location, '') AS location,
  CASE
    WHEN LOWER(TRIM(a.status)) = 'available' THEN 'available'
    WHEN LOWER(TRIM(a.status)) = 'reserved' THEN 'reserved'
    WHEN LOWER(TRIM(a.status)) = 'damaged' THEN 'damaged'
    ELSE 'available'
  END AS status,
  NOW() AS created_at,
  NOW() AS updated_at
FROM assets a
WHERE a.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM inventory i WHERE i.asset_id = a.id);