-- Read-only diagnostic. Does not change or delete application data.
-- Physical asset absence and audit trails are reported separately: without a
-- retained asset snapshot or permanent-delete event, an orphan stays UNKNOWN.
SELECT
  assignment.id AS assignment_id,
  assignment.asset_id,
  CASE WHEN asset.id IS NULL THEN 'NO' ELSE 'YES' END AS asset_exists,
  CASE
    WHEN asset.id IS NULL THEN 'NOT FOUND'
    WHEN asset.deleted_at IS NOT NULL THEN CONCAT('SOFT DELETED: ', COALESCE(asset.status, ''))
    ELSE COALESCE(asset.status, 'UNKNOWN')
  END AS asset_lifecycle_status,
  CASE WHEN assignment.assigned_to_type = 'user'
    THEN COALESCE(assignment.assigned_to_id, assignment.assigned_to)
    ELSE NULL
  END AS assigned_user_id,
  CASE
    WHEN assignment.assigned_to_type <> 'user' THEN 'NOT A USER RECIPIENT'
    WHEN assigned_user.id IS NULL THEN 'NO'
    ELSE 'YES'
  END AS user_exists,
  CASE
    WHEN assignment.assigned_to_type <> 'user' THEN 'NOT APPLICABLE'
    WHEN assigned_user.id IS NULL THEN 'NOT FOUND'
    WHEN assigned_user.active = 0 OR assigned_user.status <> 'active' THEN CONCAT('INACTIVE: ', assigned_user.status)
    ELSE 'ACTIVE'
  END AS user_lifecycle_status,
  assignment.department_id,
  assignment.status AS assignment_status,
  assignment.created_at AS assignment_created_at,
  assignment.updated_at AS assignment_updated_at,
  COALESCE(asset_audit.actions, '') AS asset_audit_actions,
  COALESCE(user_audit.actions, '') AS user_audit_actions,
  CASE
    WHEN asset.id IS NOT NULL AND asset.deleted_at IS NOT NULL THEN 'SOFT-DELETED REFERENCE'
    WHEN asset.id IS NULL THEN 'UNKNOWN - REQUIRES REVIEW'
    WHEN assignment.assigned_to_type = 'user' AND assigned_user.id IS NULL THEN 'UNKNOWN - REQUIRES REVIEW'
  END AS classification
FROM assignments AS assignment
LEFT JOIN assets AS asset ON asset.id = assignment.asset_id
LEFT JOIN users AS assigned_user
  ON assigned_user.id = CASE
    WHEN assignment.assigned_to_type = 'user'
      THEN COALESCE(assignment.assigned_to_id, assignment.assigned_to)
    ELSE NULL
  END
LEFT JOIN (
  SELECT entity, GROUP_CONCAT(DISTINCT action ORDER BY action SEPARATOR '; ') AS actions
  FROM audit_logs
  GROUP BY entity
) AS asset_audit ON asset_audit.entity = CONCAT('asset:', assignment.asset_id)
LEFT JOIN (
  SELECT entity, GROUP_CONCAT(DISTINCT action ORDER BY action SEPARATOR '; ') AS actions
  FROM audit_logs
  GROUP BY entity
) AS user_audit ON user_audit.entity = CONCAT(
  'user:', CASE
    WHEN assignment.assigned_to_type = 'user'
      THEN COALESCE(assignment.assigned_to_id, assignment.assigned_to)
    ELSE NULL
  END
)
WHERE asset.id IS NULL
   OR asset.deleted_at IS NOT NULL
   OR (assignment.assigned_to_type = 'user' AND assigned_user.id IS NULL)
ORDER BY assignment.id;
