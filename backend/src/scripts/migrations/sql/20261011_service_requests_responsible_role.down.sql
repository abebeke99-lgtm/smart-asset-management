-- Use only to roll back the matching migration after backing up the database.
-- Dropping responsible_role loses values written since the up migration.
SET @has_responsible_role_index := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'service_requests'
    AND INDEX_NAME = 'service_requests_responsible_role_idx'
);
SET @drop_responsible_role_index_sql := IF(
  @has_responsible_role_index > 0,
  'DROP INDEX `service_requests_responsible_role_idx` ON `service_requests`',
  'SELECT 1'
);
PREPARE drop_responsible_role_index FROM @drop_responsible_role_index_sql;
EXECUTE drop_responsible_role_index;
DEALLOCATE PREPARE drop_responsible_role_index;

SET @has_responsible_role_column := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'service_requests'
    AND COLUMN_NAME = 'responsible_role'
);
SET @drop_responsible_role_column_sql := IF(
  @has_responsible_role_column > 0,
  'ALTER TABLE `service_requests` DROP COLUMN `responsible_role`',
  'SELECT 1'
);
PREPARE drop_responsible_role_column FROM @drop_responsible_role_column_sql;
EXECUTE drop_responsible_role_column;
DEALLOCATE PREPARE drop_responsible_role_column;
