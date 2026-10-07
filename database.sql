CREATE DATABASE IF NOT EXISTS student_registration

USE student_registration;

CREATE TABLE IF NOT EXISTS college_users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  college_id VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id VARCHAR(24) NULL UNIQUE,
  student_name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL,
  mobile CHAR(10) NOT NULL,
  dob DATE NOT NULL,
  gender VARCHAR(30) NOT NULL,
  course VARCHAR(100) NOT NULL,
  academic_year VARCHAR(30) NOT NULL,
  division VARCHAR(20) NOT NULL,
  qualification VARCHAR(100) NOT NULL,
  first_preference VARCHAR(100) NOT NULL,
  second_preference VARCHAR(100) NOT NULL,
  guardian_name VARCHAR(120) NOT NULL,
  relationship VARCHAR(60) NOT NULL,
  emergency_contact CHAR(10) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  status ENUM('pending', 'approved') NOT NULL DEFAULT 'pending',
  attendance DECIMAL(5,2) NULL,
  eligibility VARCHAR(12)
    GENERATED ALWAYS AS (
      CASE
        WHEN attendance IS NULL THEN NULL
        WHEN attendance >= 75 THEN 'Eligible'
        ELSE 'Not Eligible'
      END
    ) STORED,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
