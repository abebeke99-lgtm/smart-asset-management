-- Run against the selected MySQL database. Safe to rerun.
SET @schema_name = DATABASE();

SET @statement = IF(
  NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'service_requests' AND COLUMN_NAME = 'laboratory_id'),
  'ALTER TABLE service_requests ADD COLUMN laboratory_id INT NULL',
  'SELECT 1'
);
PREPARE department_service_request_laboratory_stmt FROM @statement;
EXECUTE department_service_request_laboratory_stmt;
DEALLOCATE PREPARE department_service_request_laboratory_stmt;

UPDATE service_requests AS requests
JOIN assets AS assets
  ON assets.id = requests.asset_id
 AND assets.department_id = requests.department_id
JOIN rooms AS laboratories
  ON laboratories.department_id = requests.department_id
 AND LOWER(laboratories.room_type) LIKE '%lab%'
 AND (
   laboratories.id = assets.room_id
   OR laboratories.id = CAST(JSON_UNQUOTE(JSON_EXTRACT(assets.specifications, '$.laboratoryId')) AS UNSIGNED)
 )
SET requests.laboratory_id = laboratories.id
WHERE requests.laboratory_id IS NULL;

SET @statement = IF(
  NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'service_requests' AND INDEX_NAME = 'service_requests_laboratory_id_idx'),
  'CREATE INDEX service_requests_laboratory_id_idx ON service_requests (laboratory_id)',
  'SELECT 1'
);
PREPARE department_service_request_laboratory_stmt FROM @statement;
EXECUTE department_service_request_laboratory_stmt;
DEALLOCATE PREPARE department_service_request_laboratory_stmt;

SET @statement = IF(
  NOT EXISTS (SELECT 1 FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = @schema_name AND TABLE_NAME = 'service_requests' AND CONSTRAINT_NAME = 'service_requests_laboratory_fk'),
  'ALTER TABLE service_requests ADD CONSTRAINT service_requests_laboratory_fk FOREIGN KEY (laboratory_id) REFERENCES rooms (id) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE department_service_request_laboratory_stmt FROM @statement;
EXECUTE department_service_request_laboratory_stmt;
DEALLOCATE PREPARE department_service_request_laboratory_stmt;
