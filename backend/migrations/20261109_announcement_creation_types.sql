ALTER TABLE announcements ADD COLUMN announcement_type VARCHAR(32) NOT NULL DEFAULT 'announcement';
ALTER TABLE announcements ADD COLUMN circular_numbers LONGTEXT NULL;
ALTER TABLE announcements ADD COLUMN circular_signatory VARCHAR(255) NULL;
ALTER TABLE announcements ADD COLUMN circular_designation VARCHAR(255) NULL;
ALTER TABLE announcements ADD COLUMN event_date DATE NULL;
ALTER TABLE announcements ADD COLUMN event_time VARCHAR(100) NULL;
ALTER TABLE announcements ADD COLUMN event_venue VARCHAR(255) NULL;
ALTER TABLE announcements ADD COLUMN achievement_data LONGTEXT NULL;
ALTER TABLE announcements ADD COLUMN file_name VARCHAR(255) NULL;
ALTER TABLE announcements ADD COLUMN requires_registration TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE announcements ADD COLUMN max_seats INT NULL;
ALTER TABLE announcements ADD COLUMN registration_deadline DATETIME NULL;
ALTER TABLE announcements ADD COLUMN custom_registration_field VARCHAR(255) NULL;
ALTER TABLE announcements ADD COLUMN registration_form_fields LONGTEXT NULL;

ALTER TABLE announcements MODIFY COLUMN image_url LONGTEXT NULL;

CREATE TABLE IF NOT EXISTS announcement_circular_sequences (
  college_name VARCHAR(255) NOT NULL,
  series_year SMALLINT UNSIGNED NOT NULL,
  last_number INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (college_name, series_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS announcement_registrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  announcement_id INT NOT NULL,
  student_id INT NOT NULL,
  student_name VARCHAR(255) NULL,
  pin_number VARCHAR(100) NULL,
  college VARCHAR(255) NULL,
  branch VARCHAR(255) NULL,
  current_year VARCHAR(50) NULL,
  current_semester VARCHAR(50) NULL,
  phone VARCHAR(50) NULL,
  email VARCHAR(255) NULL,
  custom_field_value TEXT NULL,
  form_responses LONGTEXT NULL,
  registered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(32) NOT NULL DEFAULT 'confirmed',
  UNIQUE KEY uq_announcement_student (announcement_id, student_id),
  INDEX idx_announcement_registration (announcement_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
