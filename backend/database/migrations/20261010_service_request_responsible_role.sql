-- Safe to rerun against the selected MySQL database.
SET @schema_name = DATABASE();

SET @statement = IF(
  NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'service_requests'
      AND COLUMN_NAME = 'responsible_role'
  ),
  'ALTER TABLE service_requests ADD COLUMN responsible_role VARCHAR(100) NULL',
  'SELECT 1'
);
PREPARE service_request_responsible_role_stmt FROM @statement;
EXECUTE service_request_responsible_role_stmt;
DEALLOCATE PREPARE service_request_responsible_role_stmt;

SET @statement = IF(
  NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'service_requests'
      AND INDEX_NAME = 'service_requests_responsible_role_idx'
  ),
  'CREATE INDEX service_requests_responsible_role_idx ON service_requests (responsible_role)',
  'SELECT 1'
);
PREPARE service_request_responsible_role_stmt FROM @statement;
EXECUTE service_request_responsible_role_stmt;
DEALLOCATE PREPARE service_request_responsible_role_stmt;
