-- Idempotent schema and defaults for the Roles & Permissions module.
SET @schema_name = DATABASE();

SET @statement = IF(
  NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'roles' AND COLUMN_NAME = 'description'),
  'ALTER TABLE roles ADD COLUMN description VARCHAR(500) NOT NULL DEFAULT ''''',
  'SELECT 1'
);
PREPARE roles_permissions_stmt FROM @statement;
EXECUTE roles_permissions_stmt;
DEALLOCATE PREPARE roles_permissions_stmt;

SET @statement = IF(
  NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'roles' AND COLUMN_NAME = 'is_system'),
  'ALTER TABLE roles ADD COLUMN is_system TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE roles_permissions_stmt FROM @statement;
EXECUTE roles_permissions_stmt;
DEALLOCATE PREPARE roles_permissions_stmt;

CREATE TABLE IF NOT EXISTS permissions (
  id INT NOT NULL AUTO_INCREMENT,
  `key` VARCHAR(191) NOT NULL,
  module VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY permissions_key_unique (`key`),
  UNIQUE KEY permissions_module_action_unique (module, action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_permissions (
  id INT NOT NULL AUTO_INCREMENT,
  role_id INT NOT NULL,
  permission_id INT NOT NULL,
  scope_type ENUM('system', 'college', 'department', 'store', 'location', 'own') NOT NULL DEFAULT 'system',
  limited TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY role_permissions_role_permission_unique (role_id, permission_id),
  CONSTRAINT role_permissions_role_fk FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT role_permissions_permission_fk FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_roles (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  role_id INT NOT NULL,
  scope_type ENUM('system', 'college', 'department', 'store', 'location', 'own') NOT NULL DEFAULT 'system',
  scope_id INT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY user_roles_assignment_unique (user_id, role_id, scope_type, scope_id),
  KEY user_roles_scope_idx (scope_type, scope_id),
  CONSTRAINT user_roles_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT user_roles_role_fk FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

UPDATE roles SET display_name = CASE name
  WHEN 'admin' THEN 'Administrator'
  WHEN 'ict_officer' THEN 'ICT Officer'
  WHEN 'college_manager' THEN 'College Manager'
  WHEN 'store_manager' THEN 'Store Manager'
  WHEN 'maintenance' THEN 'Maintenance Coordinator'
  WHEN 'infrastructure' THEN 'Infrastructure / Facilities'
  WHEN 'department_head' THEN 'Department Head'
  WHEN 'teaching_assistant' THEN 'Teaching Assistant'
  WHEN 'finance' THEN 'Finance'
  WHEN 'college' THEN 'College'
  WHEN 'staff' THEN 'Staff'
  WHEN 'student' THEN 'Student'
  ELSE display_name
END,
is_system = 1,
description = CASE
  WHEN description = '' THEN CASE name
    WHEN 'admin' THEN 'System administration'
    WHEN 'ict_officer' THEN 'Information and communications technology operations'
    WHEN 'college_manager' THEN 'College-level management'
    WHEN 'store_manager' THEN 'Store and inventory management'
    WHEN 'maintenance' THEN 'Maintenance coordination'
    WHEN 'infrastructure' THEN 'Infrastructure and facilities management'
    WHEN 'department_head' THEN 'Department leadership'
    WHEN 'teaching_assistant' THEN 'Teaching assistant access'
    WHEN 'finance' THEN 'Financial review and accounting'
    WHEN 'college' THEN 'College-level operational management'
    WHEN 'staff' THEN 'Standard staff access'
    WHEN 'student' THEN 'Student access'
    ELSE description
  END
  ELSE description
END
WHERE name IN ('admin', 'ict_officer', 'college_manager', 'store_manager', 'maintenance', 'infrastructure', 'department_head', 'teaching_assistant', 'finance', 'college', 'staff', 'student');

INSERT INTO roles (name, display_name, description, is_system, active, created_at, updated_at)
VALUES
  ('admin', 'Administrator', 'System administration', 1, 1, NOW(), NOW()),
  ('ict_officer', 'ICT Officer', 'Information and communications technology operations', 1, 1, NOW(), NOW()),
  ('college_manager', 'College Manager', 'College-level management', 1, 1, NOW(), NOW()),
  ('store_manager', 'Store Manager', 'Store and inventory management', 1, 1, NOW(), NOW()),
  ('maintenance', 'Maintenance Coordinator', 'Maintenance coordination', 1, 1, NOW(), NOW()),
  ('infrastructure', 'Infrastructure / Facilities', 'Infrastructure and facilities management', 1, 1, NOW(), NOW()),
  ('department_head', 'Department Head', 'Department leadership', 1, 1, NOW(), NOW()),
  ('teaching_assistant', 'Teaching Assistant', 'Teaching assistant access', 1, 1, NOW(), NOW()),
  ('finance', 'Finance', 'Financial review and accounting', 1, 1, NOW(), NOW()),
  ('college', 'College', 'College-level operational management', 1, 1, NOW(), NOW()),
  ('staff', 'Staff', 'Standard staff access', 1, 1, NOW(), NOW()),
  ('student', 'Student', 'Student access', 1, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), is_system = 1;

INSERT INTO user_roles (user_id, role_id, scope_type, scope_id, created_at, updated_at)
SELECT u.id, r.id,
  CASE
    WHEN r.name = 'college_manager' AND u.college_id IS NOT NULL THEN 'college'
    WHEN r.name = 'department_head' AND u.department_id IS NOT NULL THEN 'department'
    WHEN r.name = 'finance' AND u.college_id IS NOT NULL THEN 'college'
    WHEN r.name IN ('college_manager', 'department_head', 'finance') THEN 'own'
    ELSE 'system'
  END,
  CASE
    WHEN r.name = 'college_manager' THEN u.college_id
    WHEN r.name = 'department_head' THEN u.department_id
    WHEN r.name = 'finance' THEN u.college_id
    ELSE NULL
  END,
  NOW(), NOW()
FROM users u
JOIN roles r ON r.name = CASE LOWER(REPLACE(REPLACE(u.role, ' ', '_'), '-', '_'))
  WHEN 'administrator' THEN 'admin'
  WHEN 'college' THEN 'college'
  WHEN 'maint' THEN 'maintenance'
  WHEN 'teaching_assistant' THEN 'teaching_assistant'
  ELSE LOWER(REPLACE(REPLACE(u.role, ' ', '_'), '-', '_'))
END
WHERE u.role IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role_id = r.id
);

INSERT INTO permissions (`key`, module, action, created_at, updated_at)
VALUES
  ('roles_permissions.view', 'roles_permissions', 'view', NOW(), NOW()),
  ('roles_permissions.create', 'roles_permissions', 'create', NOW(), NOW()),
  ('roles_permissions.edit', 'roles_permissions', 'edit', NOW(), NOW()),
  ('roles_permissions.delete', 'roles_permissions', 'delete', NOW(), NOW()),
  ('roles_permissions.approve', 'roles_permissions', 'approve', NOW(), NOW()),
  ('roles_permissions.assign', 'roles_permissions', 'assign', NOW(), NOW()),
  ('roles_permissions.transfer', 'roles_permissions', 'transfer', NOW(), NOW()),
  ('roles_permissions.maintain', 'roles_permissions', 'maintain', NOW(), NOW()),
  ('roles_permissions.report', 'roles_permissions', 'report', NOW(), NOW()),
  ('roles_permissions.configure', 'roles_permissions', 'configure', NOW(), NOW())
ON DUPLICATE KEY UPDATE `key` = VALUES(`key`);

INSERT IGNORE INTO role_permissions (role_id, permission_id, scope_type, limited, created_at, updated_at)
SELECT r.id, p.id,
  CASE
    WHEN r.name = 'admin' THEN 'system'
    WHEN r.name IN ('ict_officer', 'infrastructure') AND p.action IN ('delete', 'configure') THEN 'college'
    WHEN r.name = 'store_manager' AND p.action IN ('delete', 'configure') THEN 'store'
    WHEN r.name = 'store_manager' AND p.action = 'maintain' THEN 'store'
    WHEN r.name = 'college_manager' AND p.action = 'maintain' THEN 'college'
    WHEN r.name = 'department_head' AND p.action IN ('transfer', 'maintain') THEN 'department'
    WHEN r.name = 'finance' AND p.action IN ('create', 'edit') THEN 'college'
    ELSE 'system'
  END,
  CASE
    WHEN r.name = 'admin' THEN 0
    WHEN r.name = 'ict_officer' AND p.action IN ('delete', 'configure') THEN 1
    WHEN r.name = 'college_manager' AND p.action = 'maintain' THEN 1
    WHEN r.name = 'store_manager' AND p.action IN ('delete', 'maintain', 'configure') THEN 1
    WHEN r.name = 'infrastructure' AND p.action = 'configure' THEN 1
    WHEN r.name = 'department_head' AND p.action IN ('transfer', 'maintain') THEN 1
    WHEN r.name = 'finance' AND p.action IN ('create', 'edit') THEN 1
    ELSE 0
  END,
  NOW(), NOW()
FROM roles r CROSS JOIN permissions p
WHERE p.module = 'roles_permissions'
AND (
  r.name = 'admin'
  OR (r.name = 'ict_officer' AND p.action IN ('view', 'create', 'edit', 'delete', 'approve', 'assign', 'transfer', 'maintain', 'report', 'configure'))
  OR (r.name = 'college_manager' AND p.action IN ('view', 'create', 'edit', 'approve', 'assign', 'transfer', 'maintain', 'report'))
  OR (r.name = 'store_manager' AND p.action IN ('view', 'create', 'edit', 'delete', 'approve', 'assign', 'transfer', 'maintain', 'report', 'configure'))
  OR (r.name = 'maintenance' AND p.action IN ('view', 'create', 'edit', 'approve', 'maintain', 'report'))
  OR (r.name = 'infrastructure' AND p.action IN ('view', 'create', 'edit', 'approve', 'assign', 'transfer', 'maintain', 'report', 'configure'))
  OR (r.name = 'department_head' AND p.action IN ('view', 'create', 'edit', 'approve', 'assign', 'transfer', 'maintain', 'report'))
  OR (r.name = 'finance' AND p.action IN ('view', 'create', 'edit', 'approve', 'report'))
);
