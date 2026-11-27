CREATE DATABASE IF NOT EXISTS jalurtumbuh_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE jalurtumbuh_db;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS applications;
DROP TABLE IF EXISTS recruitments;
DROP TABLE IF EXISTS candidate_experiences;
DROP TABLE IF EXISTS candidate_profiles;
DROP TABLE IF EXISTS company_members;
DROP TABLE IF EXISTS companies;
DROP TABLE IF EXISTS job_categories;
DROP TABLE IF EXISTS employment_types;
DROP TABLE IF EXISTS provinces;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. USERS
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('candidate', 'company', 'admin', 'super_admin') NOT NULL DEFAULT 'candidate',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. MASTER DATA: BIDANG POSISI
CREATE TABLE job_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
);

INSERT INTO job_categories (name) VALUES
('Information Technology & Software'),
('UI/UX & Creative Design'),
('Digital Marketing & Content'),
('Finance, Accounting & Tax'),
('Human Resources & General Affair'),
('Operations & Supply Chain'),
('Sales & Business Development'),
('Engineering & Construction'),
('Administration & Customer Support');

-- 3. MASTER DATA: TIPE PEKERJAAN
CREATE TABLE employment_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
);

INSERT INTO employment_types (name) VALUES
('Fulltime'),
('Intern'),
('Hybrid'),
('Freelance'),
('Contract'),
('Remote');

-- 4. MASTER DATA: PROVINSI
CREATE TABLE provinces (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
);

INSERT INTO provinces (name) VALUES
('Aceh'), ('Sumatera Utara'), ('Sumatera Barat'), ('Riau'), ('Kepulauan Riau'),
('Jambi'), ('Sumatera Selatan'), ('Bangka Belitung'), ('Bengkulu'), ('Lampung'),
('DKI Jakarta'), ('Jawa Barat'), ('Banten'), ('Jawa Tengah'), ('DI Yogyakarta'),
('Jawa Timur'), ('Bali'), ('Nusa Tenggara Barat'), ('Nusa Tenggara Timur'),
('Kalimantan Barat'), ('Kalimantan Tengah'), ('Kalimantan Selatan'),
('Kalimantan Timur'), ('Kalimantan Utara'), ('Sulawesi Utara'), ('Gorontalo'),
('Sulawesi Tengah'), ('Sulawesi Barat'), ('Sulawesi Selatan'), ('Sulawesi Tenggara'),
('Maluku'), ('Maluku Utara'), ('Papua'), ('Papua Barat'), ('Papua Selatan'),
('Papua Tengah'), ('Papua Pegunungan'), ('Papua Barat Daya');

-- 5. COMPANIES (Profil Perusahaan + Legalitas NPWP/NIB + Paket Fitur Admin)
CREATE TABLE companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  industry VARCHAR(120) NULL,
  description TEXT NULL,
  npwp VARCHAR(30) NULL,
  nib VARCHAR(30) NULL,
  province_id INT NULL,
  detail_address TEXT NULL,
  website VARCHAR(255) NULL,
  phone VARCHAR(30) NULL,
  subscription_plan ENUM('free', 'pro', 'enterprise') NOT NULL DEFAULT 'free',
  max_active_jobs INT NOT NULL DEFAULT 10,
  can_view_cv TINYINT(1) NOT NULL DEFAULT 1,
  is_verified TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_company_province FOREIGN KEY (province_id) REFERENCES provinces(id) ON DELETE SET NULL
);

-- 6. MULTI-COMPANY MAPPING (1 User Perusahaan bisa terhubung ke beberapa perusahaan/aplikasi)
CREATE TABLE company_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  company_id INT NOT NULL,
  member_role ENUM('owner', 'recruiter') NOT NULL DEFAULT 'owner',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_company (user_id, company_id),
  CONSTRAINT fk_cm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_cm_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- 7. CANDIDATE PROFILES (Tabel 1 Kandidat: Data Diri, Pendidikan, Sertifikasi, Portfolio, CV)
CREATE TABLE candidate_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  phone VARCHAR(30) NULL,
  gender ENUM('Laki-laki', 'Perempuan') NULL,
  birth_date DATE NULL,
  province_id INT NULL,
  address TEXT NULL,
  headline VARCHAR(180) NULL,
  summary TEXT NULL,
  education_level VARCHAR(80) NULL,
  institution VARCHAR(160) NULL,
  major VARCHAR(120) NULL,
  graduation_year VARCHAR(10) NULL,
  certifications TEXT NULL,
  skills TEXT NULL,
  portfolio_url VARCHAR(255) NULL,
  linkedin_url VARCHAR(255) NULL,
  cv_path VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_cp_province FOREIGN KEY (province_id) REFERENCES provinces(id) ON DELETE SET NULL
);

-- 8. CANDIDATE EXPERIENCES (Tabel 2 Kandidat: Pengalaman Kerja)
CREATE TABLE candidate_experiences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  job_title VARCHAR(150) NOT NULL,
  company_name VARCHAR(150) NOT NULL,
  employment_type VARCHAR(50) NULL,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  is_current TINYINT(1) NOT NULL DEFAULT 0,
  description TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ce_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 9. RECRUITMENTS / LOWONGAN
CREATE TABLE recruitments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  category_id INT NOT NULL,
  employment_type_id INT NOT NULL,
  province_id INT NOT NULL,
  title VARCHAR(180) NOT NULL,
  detail_address TEXT NOT NULL,
  salary_min BIGINT NULL,
  salary_max BIGINT NULL,
  description TEXT NOT NULL,
  requirements TEXT NOT NULL,
  opened_at DATE NOT NULL,
  closed_at DATE NOT NULL,
  status ENUM('open', 'closed', 'draft') NOT NULL DEFAULT 'open',
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_rec_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_rec_category FOREIGN KEY (category_id) REFERENCES job_categories(id),
  CONSTRAINT fk_rec_emp_type FOREIGN KEY (employment_type_id) REFERENCES employment_types(id),
  CONSTRAINT fk_rec_province FOREIGN KEY (province_id) REFERENCES provinces(id),
  CONSTRAINT fk_rec_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 10. APPLICATIONS (Lamaran Kandidat)
CREATE TABLE applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  recruitment_id INT NOT NULL,
  candidate_id INT NOT NULL,
  cover_letter TEXT NULL,
  cv_snapshot_path VARCHAR(255) NULL,
  status ENUM('submitted', 'reviewed', 'interview', 'accepted', 'rejected') NOT NULL DEFAULT 'submitted',
  notes TEXT NULL,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_recruitment_candidate (recruitment_id, candidate_id),
  CONSTRAINT fk_app_recruitment FOREIGN KEY (recruitment_id) REFERENCES recruitments(id) ON DELETE CASCADE,
  CONSTRAINT fk_app_candidate FOREIGN KEY (candidate_id) REFERENCES users(id) ON DELETE CASCADE
);
