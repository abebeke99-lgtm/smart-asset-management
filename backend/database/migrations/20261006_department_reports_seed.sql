-- Repeatable sample data for the Engineering Department Reports page.
-- This uses the existing Engineering department and department-head account.
SET @engineering_department_id = (
  SELECT id FROM departments WHERE name = 'Engineering' ORDER BY id LIMIT 1
);

INSERT INTO assets (
  name, category, description, serial_number, asset_code, digital_id, qr_code,
  status, `condition`, department, college_id, department_id, location, quantity,
  unit, subcategory, purchase_date, purchase_price, current_value, health_score,
  created_by, created_at, updated_at
)
SELECT
  sample.name, sample.category, sample.description, sample.serial_number, sample.asset_code,
  CONCAT('QR-', sample.asset_code), CONCAT('QR-', sample.asset_code),
  sample.status, sample.asset_condition, department.name,
  department.college_id, department.id, sample.location, 1, 'unit', sample.category,
  sample.purchase_date, sample.purchase_price, sample.current_value, 100,
  NULL, NOW(), NOW()
FROM (
  SELECT 'Engineering Laptop 001' AS name, 'Computers' AS category, 'Sample Engineering department laptop' AS description, 'ENG-SEED-SN-001' AS serial_number, 'ENG-SEED-001' AS asset_code, 'available' AS status, 'Good' AS asset_condition, 'Engineering Lab A' AS location, '2025-01-15' AS purchase_date, 1200.00 AS purchase_price, 1000.00 AS current_value
  UNION ALL SELECT 'Engineering Projector 001', 'Presentation Equipment', 'Sample Engineering department projector', 'ENG-SEED-SN-002', 'ENG-SEED-002', 'available', 'Good', 'Engineering Lecture Hall', '2025-02-15', 900.00, 800.00
  UNION ALL SELECT 'Engineering Workstation 001', 'Computers', 'Sample assigned Engineering workstation', 'ENG-SEED-SN-003', 'ENG-SEED-003', 'in-use', 'Good', 'Engineering Lab A', '2025-03-15', 1800.00, 1500.00
  UNION ALL SELECT 'Engineering Microscope 001', 'Laboratory Equipment', 'Sample assigned Engineering microscope', 'ENG-SEED-SN-004', 'ENG-SEED-004', 'in-use', 'Good', 'Engineering Lab B', '2025-04-15', 2400.00, 2000.00
  UNION ALL SELECT 'Engineering Printer 001', 'Printers', 'Sample Engineering department printer awaiting maintenance', 'ENG-SEED-SN-005', 'ENG-SEED-005', 'under-maintenance', 'Fair', 'Engineering Office', '2025-05-15', 700.00, 450.00
) AS sample
JOIN departments AS department ON department.id = @engineering_department_id
WHERE NOT EXISTS (
  SELECT 1 FROM assets AS existing
  WHERE existing.asset_code = sample.asset_code
);

DELETE assignment
FROM assignments AS assignment
JOIN assets AS asset ON asset.id = assignment.asset_id
WHERE asset.asset_code IN ('ENG-SEED-003', 'ENG-SEED-004')
  AND assignment.notes = 'Engineering report sample assignment'
  AND assignment.assigned_to <> (
    SELECT MIN(staff.id)
    FROM users AS staff
    WHERE staff.department_id = asset.department_id AND staff.active = 1
  );

INSERT INTO assignments (
  asset_id, assigned_to, assigned_to_type, assigned_to_id, assigned_by, status,
  workflow_status, assigned_date, department_id, location, notes, created_at, updated_at
)
SELECT asset.id, staff.id, 'user', staff.id, staff.id, 'active', 'assigned',
  NOW(), department.id, asset.location, 'Engineering report sample assignment', NOW(), NOW()
FROM assets AS asset
JOIN departments AS department ON department.id = @engineering_department_id
JOIN users AS staff ON staff.id = (
  SELECT MIN(eligible.id)
  FROM users AS eligible
  WHERE eligible.department_id = department.id AND eligible.active = 1
)
WHERE asset.department_id = department.id
  AND asset.asset_code IN ('ENG-SEED-003', 'ENG-SEED-004')
  AND NOT EXISTS (
    SELECT 1 FROM assignments AS existing
    WHERE existing.asset_id = asset.id AND existing.assigned_to = staff.id AND existing.status = 'active'
  );

DELETE maintenance
FROM maintenances AS maintenance
JOIN assets AS asset ON asset.id = maintenance.asset_id
WHERE asset.asset_code = 'ENG-SEED-005'
  AND maintenance.title = 'Engineering printer inspection'
  AND maintenance.description = 'Sample maintenance request for the Engineering report'
  AND maintenance.requested_by <> (
    SELECT MIN(staff.id)
    FROM users AS staff
    WHERE staff.department_id = asset.department_id AND staff.active = 1
  );

INSERT INTO maintenances (
  asset_id, requested_by, title, description, status, priority, created_at, updated_at
)
SELECT asset.id, staff.id, 'Engineering printer inspection', 'Sample maintenance request for the Engineering report', 'pending', 'medium', NOW(), NOW()
FROM assets AS asset
JOIN departments AS department ON department.id = @engineering_department_id
JOIN users AS staff ON staff.id = (
  SELECT MIN(eligible.id)
  FROM users AS eligible
  WHERE eligible.department_id = department.id AND eligible.active = 1
)
WHERE asset.department_id = department.id
  AND asset.asset_code = 'ENG-SEED-005'
  AND NOT EXISTS (
    SELECT 1 FROM maintenances AS existing
    WHERE existing.asset_id = asset.id AND existing.title = 'Engineering printer inspection'
  );

DELETE approval
FROM approvals AS approval
WHERE approval.department_id = @engineering_department_id
  AND approval.item = 'Engineering Lab Equipment Request'
  AND approval.reason = 'Sample request for validating Engineering department reports'
  AND approval.requested_by <> (
    SELECT MIN(staff.id)
    FROM users AS staff
    WHERE staff.department_id = @engineering_department_id AND staff.active = 1
  );

INSERT INTO approvals (
  requested_by, department_id, type, item, quantity, priority, status, reason, comment, created_at, updated_at
)
SELECT staff.id, department.id, 'asset_request', 'Engineering Lab Equipment Request', 1, 'medium', 'pending',
  'Sample request for validating Engineering department reports', '', NOW(), NOW()
FROM departments AS department
JOIN users AS staff ON staff.id = (
  SELECT MIN(eligible.id)
  FROM users AS eligible
  WHERE eligible.department_id = department.id AND eligible.active = 1
)
WHERE department.id = @engineering_department_id
  AND NOT EXISTS (
    SELECT 1 FROM approvals AS existing
    WHERE existing.department_id = department.id AND existing.item = 'Engineering Lab Equipment Request'
  );
