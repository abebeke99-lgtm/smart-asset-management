-- Safe to rerun against the selected MySQL database.
SET @schema_name = DATABASE();

SET @statement = IF(
  NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'assignments'
      AND COLUMN_NAME = 'approval_id'
  ),
  'ALTER TABLE assignments ADD COLUMN approval_id INT NULL',
  'SELECT 1'
);
PREPARE store_workflow_columns_stmt FROM @statement;
EXECUTE store_workflow_columns_stmt;
DEALLOCATE PREPARE store_workflow_columns_stmt;

SET @statement = IF(
  NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'assignments'
      AND COLUMN_NAME = 'quantity'
  ),
  'ALTER TABLE assignments ADD COLUMN quantity INT NOT NULL DEFAULT 1',
  'SELECT 1'
);
PREPARE store_workflow_columns_stmt FROM @statement;
EXECUTE store_workflow_columns_stmt;
DEALLOCATE PREPARE store_workflow_columns_stmt;

SET @statement = IF(
  NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'asset_returns'
      AND COLUMN_NAME = 'quantity'
  ),
  'ALTER TABLE asset_returns ADD COLUMN quantity INT NOT NULL DEFAULT 1',
  'SELECT 1'
);
PREPARE store_workflow_columns_stmt FROM @statement;
EXECUTE store_workflow_columns_stmt;
DEALLOCATE PREPARE store_workflow_columns_stmt;
