-- Safe to rerun against the selected MySQL database.
SET @schema_name = DATABASE();

SET @statement = IF(
  NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'approvals'
      AND COLUMN_NAME = 'requested_for'
  ),
  'ALTER TABLE approvals ADD COLUMN requested_for INT NULL',
  'SELECT 1'
);
PREPARE approval_request_details_stmt FROM @statement;
EXECUTE approval_request_details_stmt;
DEALLOCATE PREPARE approval_request_details_stmt;

SET @statement = IF(
  NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'approvals'
      AND COLUMN_NAME = 'required_date'
  ),
  'ALTER TABLE approvals ADD COLUMN required_date DATE NULL',
  'SELECT 1'
);
PREPARE approval_request_details_stmt FROM @statement;
EXECUTE approval_request_details_stmt;
DEALLOCATE PREPARE approval_request_details_stmt;
