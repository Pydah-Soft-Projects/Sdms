ALTER TABLE events
  ADD COLUMN requires_registration TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN max_seats INT NULL,
  ADD COLUMN registration_deadline DATETIME NULL,
  ADD COLUMN registration_form_fields JSON NULL;

CREATE TABLE IF NOT EXISTS event_registrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  student_id INT NOT NULL,
  student_name VARCHAR(255) NOT NULL,
  pin_number VARCHAR(100) NULL,
  college VARCHAR(255) NULL,
  branch VARCHAR(255) NULL,
  current_year VARCHAR(50) NULL,
  current_semester VARCHAR(50) NULL,
  phone VARCHAR(50) NULL,
  email VARCHAR(255) NULL,
  form_responses JSON NULL,
  status ENUM('confirmed', 'cancelled') NOT NULL DEFAULT 'confirmed',
  registered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_event_registration_student (event_id, student_id),
  INDEX idx_event_registration_status (event_id, status),
  INDEX idx_event_registration_student (student_id),
  CONSTRAINT fk_event_registration_event
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);
