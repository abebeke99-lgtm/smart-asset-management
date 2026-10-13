-- Safe to rerun against the selected MySQL database.
-- Apply to the intended database before deploying the verification workflow changes.
SET @schema_name = DATABASE();

SET @statement = IF(
  EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'verification_items'
      AND COLUMN_NAME = 'state'
      AND COLUMN_TYPE NOT LIKE '%''pending''%'
  ),
  'ALTER TABLE verification_items MODIFY COLUMN state ENUM(''pending'', ''verified'', ''missing'', ''wrong_location'', ''damaged'', ''unidentified'', ''needs_review'') NOT NULL DEFAULT ''pending''',
  'SELECT 1'
);
PREPARE college_verification_stmt FROM @statement;
EXECUTE college_verification_stmt;
DEALLOCATE PREPARE college_verification_stmt;

SET @statement = IF(
  NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'verification_items' AND COLUMN_NAME = 'observed_location'
  ),
  'ALTER TABLE verification_items ADD COLUMN observed_location VARCHAR(255) NULL',
  'SELECT 1'
);
PREPARE college_verification_stmt FROM @statement;
EXECUTE college_verification_stmt;
DEALLOCATE PREPARE college_verification_stmt;

SET @statement = IF(
  NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'verification_items' AND COLUMN_NAME = 'verified_by'
  ),
  'ALTER TABLE verification_items ADD COLUMN verified_by INT NULL',
  'SELECT 1'
);
PREPARE college_verification_stmt FROM @statement;
EXECUTE college_verification_stmt;
DEALLOCATE PREPARE college_verification_stmt;

SET @statement = IF(
  NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'verification_items'
      AND INDEX_NAME = 'verification_items_session_asset_unique'
  ),
  'CREATE UNIQUE INDEX verification_items_session_asset_unique ON verification_items (session_id, asset_id)',
  'SELECT 1'
);
PREPARE college_verification_stmt FROM @statement;
EXECUTE college_verification_stmt;
DEALLOCATE PREPARE college_verification_stmt;
