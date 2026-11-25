-- Skema sementara. Kalau database kamu besok sudah ada, tinggal sesuaikan nama tabel/kolom
-- di folder src/modules (semua query SQL ada di sana).
CREATE DATABASE IF NOT EXISTS jalurtumbuh CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE jalurtumbuh;

CREATE TABLE IF NOT EXISTS companies (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  industry VARCHAR(100) NULL,
  location VARCHAR(150) NULL,
  website VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_companies_name (name),
  INDEX idx_companies_industry (industry)
);

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('candidate','company','admin','super_admin') NOT NULL DEFAULT 'candidate',
  company_id BIGINT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL,
  INDEX idx_users_role (role)
);

CREATE TABLE IF NOT EXISTS recruitments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id BIGINT UNSIGNED NOT NULL,
  created_by BIGINT UNSIGNED NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  requirements TEXT NULL,
  location VARCHAR(150) NULL,
  employment_type ENUM('full_time','part_time','contract','internship','freelance') NOT NULL DEFAULT 'full_time',
  salary_min INT UNSIGNED NULL,
  salary_max INT UNSIGNED NULL,
  status ENUM('draft','open','closed') NOT NULL DEFAULT 'draft',
  deadline DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_rec_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_rec_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_rec_status (status),
  INDEX idx_rec_company (company_id),
  FULLTEXT INDEX ft_rec_title (title)
);

CREATE TABLE IF NOT EXISTS applications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  recruitment_id BIGINT UNSIGNED NOT NULL,
  candidate_id BIGINT UNSIGNED NOT NULL,
  cover_letter TEXT NULL,
  resume_url VARCHAR(500) NULL,
  status ENUM('applied','reviewed','interview','offered','accepted','rejected') NOT NULL DEFAULT 'applied',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_app_rec FOREIGN KEY (recruitment_id) REFERENCES recruitments(id) ON DELETE CASCADE,
  CONSTRAINT fk_app_cand FOREIGN KEY (candidate_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_app_once (recruitment_id, candidate_id)
);
