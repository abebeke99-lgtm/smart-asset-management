-- Preserve legacy audit timestamps and add the Sequelize timestamp columns
-- used by the audit-log API without rebuilding or deleting existing rows.
SET @audit_schema = DATABASE();

SET @has_created_at = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = @audit_schema
    AND table_name = 'audit_logs'
    AND column_name = 'created_at'
);
SET @has_legacy_created_at = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = @audit_schema
    AND table_name = 'audit_logs'
    AND column_name = 'createdAt'
);
SET @has_legacy_timestamp = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = @audit_schema
    AND table_name = 'audit_logs'
    AND column_name = 'timestamp'
);
SET @add_created_at_sql = IF(
  @has_created_at = 0,
  'ALTER TABLE audit_logs ADD COLUMN created_at DATETIME NULL',
  'SELECT 1'
);
PREPARE audit_migration_statement FROM @add_created_at_sql;
EXECUTE audit_migration_statement;
DEALLOCATE PREPARE audit_migration_statement;

SET @copy_created_at_sql = IF(
  @has_legacy_created_at > 0,
  'UPDATE audit_logs SET created_at = `createdAt` WHERE created_at IS NULL',
  IF(
    @has_legacy_timestamp > 0,
    'UPDATE audit_logs SET created_at = `timestamp` WHERE created_at IS NULL',
    'UPDATE audit_logs SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL'
  )
);
PREPARE audit_migration_statement FROM @copy_created_at_sql;
EXECUTE audit_migration_statement;
DEALLOCATE PREPARE audit_migration_statement;

SET @has_updated_at = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = @audit_schema
    AND table_name = 'audit_logs'
    AND column_name = 'updated_at'
);
SET @add_updated_at_sql = IF(
  @has_updated_at = 0,
  'ALTER TABLE audit_logs ADD COLUMN updated_at DATETIME NULL',
  'SELECT 1'
);
PREPARE audit_migration_statement FROM @add_updated_at_sql;
EXECUTE audit_migration_statement;
DEALLOCATE PREPARE audit_migration_statement;
