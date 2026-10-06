-- Run against the selected MySQL database. Safe to rerun.
SET @schema_name = DATABASE();

SET @statement = IF(
  NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'rooms' AND COLUMN_NAME = 'responsible_staff_id'),
  'ALTER TABLE rooms ADD COLUMN responsible_staff_id INT NULL',
  'SELECT 1'
);
PREPARE department_laboratories_stmt FROM @statement;
EXECUTE department_laboratories_stmt;
DEALLOCATE PREPARE department_laboratories_stmt;

SET @statement = IF(
  NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'rooms' AND COLUMN_NAME = 'condition'),
  'ALTER TABLE rooms ADD COLUMN `condition` VARCHAR(100) NOT NULL DEFAULT ''Good''',
  'SELECT 1'
);
PREPARE department_laboratories_stmt FROM @statement;
EXECUTE department_laboratories_stmt;
DEALLOCATE PREPARE department_laboratories_stmt;

SET @statement = IF(
  EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'rooms' AND COLUMN_NAME = 'status' AND DATA_TYPE = 'enum'),
  'ALTER TABLE rooms MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT ''Active''',
  'SELECT 1'
);
PREPARE department_laboratories_stmt FROM @statement;
EXECUTE department_laboratories_stmt;
DEALLOCATE PREPARE department_laboratories_stmt;

UPDATE rooms SET status = CASE LOWER(status)
  WHEN 'active' THEN 'Active'
  WHEN 'inactive' THEN 'Inactive'
  WHEN 'temporarily closed' THEN 'Temporarily Closed'
  WHEN 'under maintenance' THEN 'Under Maintenance'
  WHEN 'restricted' THEN 'Restricted'
  ELSE status
END;

SET @statement = IF(
  NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'rooms' AND INDEX_NAME = 'rooms_responsible_staff_id_idx'),
  'CREATE INDEX rooms_responsible_staff_id_idx ON rooms (responsible_staff_id)',
  'SELECT 1'
);
PREPARE department_laboratories_stmt FROM @statement;
EXECUTE department_laboratories_stmt;
DEALLOCATE PREPARE department_laboratories_stmt;

SET @statement = IF(
  NOT EXISTS (SELECT 1 FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = @schema_name AND TABLE_NAME = 'rooms' AND CONSTRAINT_NAME = 'rooms_responsible_staff_fk'),
  'ALTER TABLE rooms ADD CONSTRAINT rooms_responsible_staff_fk FOREIGN KEY (responsible_staff_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE department_laboratories_stmt FROM @statement;
EXECUTE department_laboratories_stmt;
DEALLOCATE PREPARE department_laboratories_stmt;
