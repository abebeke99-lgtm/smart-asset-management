-- Select smart_asset_db in phpMyAdmin before running this idempotent migration.
-- The nullable column preserves existing service-request rows.
SET @has_responsible_role_column := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'service_requests'
    AND COLUMN_NAME = 'responsible_role'
);
SET @add_responsible_role_column_sql := IF(
  @has_responsible_role_column = 0,
  'ALTER TABLE `service_requests` ADD COLUMN `responsible_role` VARCHAR(100) NULL',
  'SELECT 1'
);
PREPARE add_responsible_role_column FROM @add_responsible_role_column_sql;
EXECUTE add_responsible_role_column;
DEALLOCATE PREPARE add_responsible_role_column;

SET @has_responsible_role_index := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'service_requests'
    AND INDEX_NAME = 'service_requests_responsible_role_idx'
);
SET @add_responsible_role_index_sql := IF(
  @has_responsible_role_index = 0,
  'CREATE INDEX `service_requests_responsible_role_idx` ON `service_requests` (`responsible_role`)',
  'SELECT 1'
);
PREPARE add_responsible_role_index FROM @add_responsible_role_index_sql;
EXECUTE add_responsible_role_index;
DEALLOCATE PREPARE add_responsible_role_index;
