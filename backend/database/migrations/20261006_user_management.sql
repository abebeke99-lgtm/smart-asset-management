-- Run against the selected MySQL database. Safe to rerun.
SET @schema_name = DATABASE();

SET @statement = IF(
  EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'users' AND COLUMN_NAME = 'password')
  AND NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'users' AND COLUMN_NAME = 'password_hash'),
  'ALTER TABLE users CHANGE COLUMN password password_hash VARCHAR(255) NOT NULL',
  'SELECT 1'
);
PREPARE user_management_stmt FROM @statement;
EXECUTE user_management_stmt;
DEALLOCATE PREPARE user_management_stmt;

SET @statement = IF(
  EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'users' AND COLUMN_NAME = 'last_login_at')
  AND NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'users' AND COLUMN_NAME = 'last_login'),
  'ALTER TABLE users CHANGE COLUMN last_login_at last_login DATETIME NULL',
  'SELECT 1'
);
PREPARE user_management_stmt FROM @statement;
EXECUTE user_management_stmt;
DEALLOCATE PREPARE user_management_stmt;

SET @statement = IF(
  NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'users' AND COLUMN_NAME = 'status'),
  'ALTER TABLE users ADD COLUMN status ENUM(''active'', ''inactive'', ''suspended'') NOT NULL DEFAULT ''active''',
  'SELECT 1'
);
PREPARE user_management_stmt FROM @statement;
EXECUTE user_management_stmt;
DEALLOCATE PREPARE user_management_stmt;

UPDATE users SET status = CASE WHEN active = 1 THEN 'active' ELSE 'inactive' END WHERE status = 'active' AND active = 0;

CREATE TABLE IF NOT EXISTS roles (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  display_name VARCHAR(150) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY roles_name_unique (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_activity_logs (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id INT NULL,
  action VARCHAR(255) NOT NULL,
  ip VARCHAR(45) NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY user_activity_logs_user_created_idx (user_id, created_at),
  CONSTRAINT user_activity_logs_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO roles (name, display_name, active, created_at, updated_at)
VALUES
  ('admin', 'Administrator', 1, NOW(), NOW()),
  ('ict_officer', 'ICT Officer', 1, NOW(), NOW()),
  ('college', 'College', 1, NOW(), NOW()),
  ('college_manager', 'College Manager', 1, NOW(), NOW()),
  ('department_head', 'Department Head', 1, NOW(), NOW()),
  ('finance', 'Finance', 1, NOW(), NOW()),
  ('store_manager', 'Store Manager', 1, NOW(), NOW()),
  ('maintenance', 'Maintenance', 1, NOW(), NOW()),
  ('infrastructure', 'Infrastructure', 1, NOW(), NOW()),
  ('staff', 'Staff', 1, NOW(), NOW()),
  ('student', 'Student', 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), active = 1, updated_at = NOW();

INSERT IGNORE INTO colleges (college_code, college_name, status, created_at, updated_at)
VALUES
  ('SAMPLE-ENG', 'College of Engineering', 'active', NOW(), NOW()),
  ('SAMPLE-BUS', 'College of Business', 'active', NOW(), NOW()),
  ('SAMPLE-SCI', 'College of Natural Sciences', 'active', NOW(), NOW());

INSERT IGNORE INTO departments (name, code, college_id, status, created_at, updated_at)
SELECT seed.name, seed.code, college.id, 'active', NOW(), NOW()
FROM (
  SELECT 'Computer Science' AS name, 'CS' AS code, 'SAMPLE-ENG' AS college_code
  UNION ALL SELECT 'Electrical Engineering', 'EE', 'SAMPLE-ENG'
  UNION ALL SELECT 'Management', 'MGT', 'SAMPLE-BUS'
  UNION ALL SELECT 'Accounting', 'ACC', 'SAMPLE-BUS'
  UNION ALL SELECT 'Biology', 'BIO', 'SAMPLE-SCI'
  UNION ALL SELECT 'Chemistry', 'CHEM', 'SAMPLE-SCI'
) AS seed
JOIN colleges AS college ON college.college_code = seed.college_code;
