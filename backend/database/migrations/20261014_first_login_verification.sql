ALTER TABLE users
  ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN email_verified_at DATETIME NULL,
  ADD COLUMN phone_verified_at DATETIME NULL,
  ADD COLUMN password_changed_at DATETIME NULL;

CREATE TABLE IF NOT EXISTS verification_codes (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  channel ENUM('email', 'phone') NOT NULL,
  code_hash CHAR(64) NOT NULL,
  purpose ENUM('first_login', 'forgot_password') NOT NULL,
  expires_at DATETIME NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY verification_codes_user_purpose_created_idx (user_id, purpose, created_at),
  KEY verification_codes_expiry_idx (expires_at),
  CONSTRAINT verification_codes_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
