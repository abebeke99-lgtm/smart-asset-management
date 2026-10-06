-- Create department-scoped asset requests and their durable status history.
CREATE TABLE IF NOT EXISTS department_asset_requests (
  id INT NOT NULL AUTO_INCREMENT,
  request_code VARCHAR(40) NOT NULL,
  department_id INT NOT NULL,
  requested_by INT NOT NULL,
  asset_id INT NULL,
  requested_item VARCHAR(255) NOT NULL,
  category VARCHAR(120) NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit VARCHAR(50) NOT NULL DEFAULT 'unit',
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  status VARCHAR(30) NOT NULL DEFAULT 'Submitted',
  justification TEXT NOT NULL,
  description TEXT NULL,
  estimated_value DECIMAL(15,2) NULL,
  needed_by DATE NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY department_asset_requests_request_code_uq (request_code),
  KEY department_asset_requests_department_status_idx (department_id, status),
  KEY department_asset_requests_requested_by_idx (requested_by),
  KEY department_asset_requests_asset_idx (asset_id),
  CONSTRAINT department_asset_requests_department_fk FOREIGN KEY (department_id) REFERENCES departments (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT department_asset_requests_requester_fk FOREIGN KEY (requested_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT department_asset_requests_asset_fk FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS department_asset_request_histories (
  id INT NOT NULL AUTO_INCREMENT,
  request_id INT NOT NULL,
  previous_status VARCHAR(30) NULL,
  new_status VARCHAR(30) NOT NULL,
  changed_by INT NOT NULL,
  comment VARCHAR(1000) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY department_asset_request_histories_request_idx (request_id),
  CONSTRAINT department_asset_request_histories_request_fk FOREIGN KEY (request_id) REFERENCES department_asset_requests (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT department_asset_request_histories_user_fk FOREIGN KEY (changed_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE
);
