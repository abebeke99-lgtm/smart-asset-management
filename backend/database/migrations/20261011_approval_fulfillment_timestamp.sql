-- Safe to rerun against the selected MySQL database.
SET @schema_name = DATABASE();

SET @statement = IF(
  NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'approvals'
      AND COLUMN_NAME = 'fulfilled_at'
  ),
  'ALTER TABLE approvals ADD COLUMN fulfilled_at DATETIME NULL',
  'SELECT 1'
);
PREPARE approval_fulfillment_timestamp_stmt FROM @statement;
EXECUTE approval_fulfillment_timestamp_stmt;
DEALLOCATE PREPARE approval_fulfillment_timestamp_stmt;
