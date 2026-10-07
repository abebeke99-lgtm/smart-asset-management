-- Run node src/scripts/migrations/departmentHeadAssetRegistration.js to normalize and
-- safely add global unique serial-number indexes to assets and asset_requests.
CREATE TABLE IF NOT EXISTS asset_history (
  id INT NOT NULL AUTO_INCREMENT,
  asset_id INT NOT NULL,
  department_id INT NOT NULL,
  changed_by INT NOT NULL,
  action VARCHAR(100) NOT NULL,
  old_value JSON NULL,
  new_value JSON NULL,
  details JSON NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY asset_history_asset_created_idx (asset_id, created_at),
  KEY asset_history_department_created_idx (department_id, created_at),
  CONSTRAINT asset_history_asset_fk FOREIGN KEY (asset_id) REFERENCES assets (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT asset_history_department_fk FOREIGN KEY (department_id) REFERENCES departments (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT asset_history_user_fk FOREIGN KEY (changed_by) REFERENCES users (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS asset_requests (
  id INT NOT NULL AUTO_INCREMENT,
  department_id INT NOT NULL,
  requested_by INT NOT NULL,
  approval_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(255) NOT NULL,
  serial_number VARCHAR(255) NULL,
  quantity INT NOT NULL DEFAULT 1,
  `condition` VARCHAR(100) NOT NULL,
  location VARCHAR(255) NOT NULL,
  purchase_date DATE NULL,
  warranty_expiry DATE NULL,
  justification TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Pending',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY asset_requests_approval_uq (approval_id),
  UNIQUE KEY asset_requests_serial_number_uq (serial_number),
  KEY asset_requests_department_status_idx (department_id, status),
  KEY asset_requests_requested_by_idx (requested_by),
  CONSTRAINT asset_requests_quantity_positive CHECK (quantity > 0),
  CONSTRAINT asset_requests_department_fk FOREIGN KEY (department_id) REFERENCES departments (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT asset_requests_requester_fk FOREIGN KEY (requested_by) REFERENCES users (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT asset_requests_approval_fk FOREIGN KEY (approval_id) REFERENCES approvals (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;
