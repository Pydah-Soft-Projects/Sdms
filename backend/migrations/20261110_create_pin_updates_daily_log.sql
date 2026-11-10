-- Migration: Add student daily PIN updates tracking table
-- Purpose: Aggregate PIN updates so they are sent along with daily attendance reports instead of individual emails per student
-- Date: 2026-11-10

CREATE TABLE IF NOT EXISTS pin_updates_daily_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NULL,
    admission_number VARCHAR(100) NOT NULL,
    student_name VARCHAR(255) NULL,
    pin_no VARCHAR(50) NOT NULL,
    college VARCHAR(255) NULL,
    college_id INT NULL,
    course VARCHAR(255) NULL,
    course_id INT NULL,
    branch VARCHAR(255) NULL,
    branch_id INT NULL,
    batch VARCHAR(100) NULL,
    current_year TINYINT NULL,
    current_semester TINYINT NULL,
    update_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_student_date (admission_number, update_date),
    INDEX idx_update_date (update_date),
    INDEX idx_college (college_id),
    INDEX idx_course (course_id),
    INDEX idx_branch (branch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

