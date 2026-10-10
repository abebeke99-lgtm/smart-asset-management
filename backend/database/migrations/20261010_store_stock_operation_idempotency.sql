-- Safe to rerun against the selected MySQL database.
SET @schema_name = DATABASE();

SET @statement = IF(
  NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'inventory_transactions'
      AND COLUMN_NAME = 'submission_id'
  ),
  'ALTER TABLE inventory_transactions ADD COLUMN submission_id VARCHAR(100) NULL',
  'SELECT 1'
);
PREPARE store_stock_idempotency_stmt FROM @statement;
EXECUTE store_stock_idempotency_stmt;
DEALLOCATE PREPARE store_stock_idempotency_stmt;

SET @statement = IF(
  NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'inventory_transactions'
      AND COLUMN_NAME = 'reference_key'
  ),
  'ALTER TABLE inventory_transactions ADD COLUMN reference_key VARCHAR(100) NULL',
  'SELECT 1'
);
PREPARE store_stock_idempotency_stmt FROM @statement;
EXECUTE store_stock_idempotency_stmt;
DEALLOCATE PREPARE store_stock_idempotency_stmt;

SET @statement = IF(
  NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'inventory_transactions'
      AND INDEX_NAME = 'inventory_transactions_submission_id_unique'
  ),
  'CREATE UNIQUE INDEX inventory_transactions_submission_id_unique ON inventory_transactions (submission_id)',
  'SELECT 1'
);
PREPARE store_stock_idempotency_stmt FROM @statement;
EXECUTE store_stock_idempotency_stmt;
DEALLOCATE PREPARE store_stock_idempotency_stmt;

SET @statement = IF(
  NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'inventory_transactions'
      AND INDEX_NAME = 'inventory_transactions_asset_reference_unique'
  ),
  'CREATE UNIQUE INDEX inventory_transactions_asset_reference_unique ON inventory_transactions (asset_id, reference_key)',
  'SELECT 1'
);
PREPARE store_stock_idempotency_stmt FROM @statement;
EXECUTE store_stock_idempotency_stmt;
DEALLOCATE PREPARE store_stock_idempotency_stmt;
