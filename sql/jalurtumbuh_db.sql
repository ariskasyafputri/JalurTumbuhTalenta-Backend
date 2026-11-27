-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Nov 27, 2026 at 10:22 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `jalurtumbuh_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `applications`
--

CREATE TABLE `applications` (
  `id` int(11) NOT NULL,
  `recruitment_id` int(11) NOT NULL,
  `candidate_id` int(11) NOT NULL,
  `cover_letter` text DEFAULT NULL,
  `cv_snapshot_path` varchar(255) DEFAULT NULL,
  `status` enum('submitted','reviewed','interview','accepted','rejected') NOT NULL DEFAULT 'submitted',
  `notes` text DEFAULT NULL,
  `applied_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `applications`
--

INSERT INTO `applications` (`id`, `recruitment_id`, `candidate_id`, `cover_letter`, `cv_snapshot_path`, `status`, `notes`, `applied_at`, `updated_at`) VALUES
(2, 2, 5, NULL, NULL, 'rejected', NULL, '2026-11-27 07:22:09', '2026-11-27 07:22:55');

-- --------------------------------------------------------

--
-- Table structure for table `benefits`
--

CREATE TABLE `benefits` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `benefits`
--

INSERT INTO `benefits` (`id`, `name`) VALUES
(2, 'Asuransi Kesehatan Swasta'),
(4, 'Bonus Kinerja / Tahunan'),
(1, 'BPJS Kesehatan & Ketenagakerjaan'),
(9, 'Cuti Tahunan & Cuti Sakit'),
(10, 'Jenjang Karier Jelas'),
(7, 'Laptop / Perangkat Kerja'),
(8, 'Pelatihan & Sertifikasi'),
(3, 'Tunjangan Hari Raya (THR)'),
(5, 'Tunjangan Transportasi / Uang Makan'),
(6, 'Work From Anywhere / Hybrid');

-- --------------------------------------------------------

--
-- Table structure for table `candidate_experiences`
--

CREATE TABLE `candidate_experiences` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `job_title` varchar(150) NOT NULL,
  `company_name` varchar(150) NOT NULL,
  `employment_type` varchar(50) DEFAULT NULL,
  `start_date` date NOT NULL,
  `end_date` date DEFAULT NULL,
  `is_current` tinyint(1) NOT NULL DEFAULT 0,
  `description` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `candidate_profiles`
--

CREATE TABLE `candidate_profiles` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `gender` enum('Laki-laki','Perempuan') DEFAULT NULL,
  `birth_date` date DEFAULT NULL,
  `province_id` int(11) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `headline` varchar(180) DEFAULT NULL,
  `summary` text DEFAULT NULL,
  `education_level` varchar(80) DEFAULT NULL,
  `institution` varchar(160) DEFAULT NULL,
  `major` varchar(120) DEFAULT NULL,
  `graduation_year` varchar(10) DEFAULT NULL,
  `additional_educations` longtext DEFAULT NULL,
  `certifications` text DEFAULT NULL,
  `certification_items` longtext DEFAULT NULL,
  `skills` text DEFAULT NULL,
  `portfolio_url` varchar(255) DEFAULT NULL,
  `portfolio_path` varchar(255) DEFAULT NULL,
  `portfolio_file_name` varchar(255) DEFAULT NULL,
  `linkedin_url` varchar(255) DEFAULT NULL,
  `social_media_url` varchar(255) DEFAULT NULL,
  `cv_path` varchar(255) DEFAULT NULL,
  `photo_path` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `candidate_profiles`
--

INSERT INTO `candidate_profiles` (`id`, `user_id`, `phone`, `gender`, `birth_date`, `province_id`, `address`, `headline`, `summary`, `education_level`, `institution`, `major`, `graduation_year`, `additional_educations`, `certifications`, `certification_items`, `skills`, `portfolio_url`, `portfolio_path`, `portfolio_file_name`, `linkedin_url`, `social_media_url`, `cv_path`, `photo_path`, `created_at`, `updated_at`) VALUES
(2, 5, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-11-27 07:09:43', '2026-11-27 07:09:43');

-- --------------------------------------------------------

--
-- Table structure for table `companies`
--

CREATE TABLE `companies` (
  `id` int(11) NOT NULL,
  `name` varchar(160) NOT NULL,
  `industry` varchar(120) DEFAULT NULL,
  `company_size` varchar(60) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `npwp` varchar(30) DEFAULT NULL,
  `nib` varchar(30) DEFAULT NULL,
  `province_id` int(11) DEFAULT NULL,
  `detail_address` text DEFAULT NULL,
  `website` varchar(255) DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `logo_path` varchar(255) DEFAULT NULL,
  `subscription_plan` enum('free','pro','enterprise') NOT NULL DEFAULT 'free',
  `max_active_jobs` int(11) NOT NULL DEFAULT 10,
  `can_view_cv` tinyint(1) NOT NULL DEFAULT 1,
  `is_verified` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `companies`
--

INSERT INTO `companies` (`id`, `name`, `industry`, `company_size`, `description`, `npwp`, `nib`, `province_id`, `detail_address`, `website`, `phone`, `logo_path`, `subscription_plan`, `max_active_jobs`, `can_view_cv`, `is_verified`, `created_at`, `updated_at`) VALUES
(2, 'PT Jalur Tumbuh', NULL, NULL, '-', '1234567890', '183878738838', 11, 'blok m', 'https://www.jalurtumbuh.com/', '0892882882', '/uploads/logos/logo-company-2-1795764819793.jpeg', 'free', 10, 1, 1, '2026-11-27 07:11:18', '2026-11-27 07:33:39');

-- --------------------------------------------------------

--
-- Table structure for table `company_members`
--

CREATE TABLE `company_members` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `company_id` int(11) NOT NULL,
  `member_role` enum('owner','recruiter') NOT NULL DEFAULT 'owner',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `company_members`
--

INSERT INTO `company_members` (`id`, `user_id`, `company_id`, `member_role`, `created_at`) VALUES
(2, 6, 2, 'owner', '2026-11-27 07:11:18');

-- --------------------------------------------------------

--
-- Table structure for table `employment_types`
--

CREATE TABLE `employment_types` (
  `id` int(11) NOT NULL,
  `name` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `employment_types`
--

INSERT INTO `employment_types` (`id`, `name`) VALUES
(5, 'Contract'),
(4, 'Freelance'),
(1, 'Fulltime'),
(3, 'Hybrid'),
(2, 'Intern'),
(6, 'Remote');

-- --------------------------------------------------------

--
-- Table structure for table `job_categories`
--

CREATE TABLE `job_categories` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `job_categories`
--

INSERT INTO `job_categories` (`id`, `name`) VALUES
(9, 'Administration & Customer Support'),
(3, 'Digital Marketing & Content'),
(8, 'Engineering & Construction'),
(4, 'Finance, Accounting & Tax'),
(5, 'Human Resources & General Affair'),
(1, 'Information Technology & Software'),
(6, 'Operations & Supply Chain'),
(7, 'Sales & Business Development'),
(2, 'UI/UX & Creative Design');

-- --------------------------------------------------------

--
-- Table structure for table `provinces`
--

CREATE TABLE `provinces` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `provinces`
--

INSERT INTO `provinces` (`id`, `name`) VALUES
(1, 'Aceh'),
(17, 'Bali'),
(8, 'Bangka Belitung'),
(13, 'Banten'),
(9, 'Bengkulu'),
(15, 'DI Yogyakarta'),
(11, 'DKI Jakarta'),
(26, 'Gorontalo'),
(6, 'Jambi'),
(12, 'Jawa Barat'),
(14, 'Jawa Tengah'),
(16, 'Jawa Timur'),
(20, 'Kalimantan Barat'),
(22, 'Kalimantan Selatan'),
(21, 'Kalimantan Tengah'),
(23, 'Kalimantan Timur'),
(24, 'Kalimantan Utara'),
(5, 'Kepulauan Riau'),
(10, 'Lampung'),
(31, 'Maluku'),
(32, 'Maluku Utara'),
(18, 'Nusa Tenggara Barat'),
(19, 'Nusa Tenggara Timur'),
(33, 'Papua'),
(34, 'Papua Barat'),
(38, 'Papua Barat Daya'),
(37, 'Papua Pegunungan'),
(35, 'Papua Selatan'),
(36, 'Papua Tengah'),
(4, 'Riau'),
(28, 'Sulawesi Barat'),
(29, 'Sulawesi Selatan'),
(27, 'Sulawesi Tengah'),
(30, 'Sulawesi Tenggara'),
(25, 'Sulawesi Utara'),
(3, 'Sumatera Barat'),
(7, 'Sumatera Selatan'),
(2, 'Sumatera Utara');

-- --------------------------------------------------------

--
-- Table structure for table `recruitments`
--

CREATE TABLE `recruitments` (
  `id` int(11) NOT NULL,
  `slug` varchar(255) NOT NULL,
  `company_id` int(11) NOT NULL,
  `category_id` int(11) NOT NULL,
  `employment_type_id` int(11) NOT NULL,
  `province_id` int(11) NOT NULL,
  `title` varchar(180) NOT NULL,
  `detail_address` text NOT NULL,
  `salary_min` bigint(20) DEFAULT NULL,
  `salary_max` bigint(20) DEFAULT NULL,
  `hide_salary` tinyint(1) NOT NULL DEFAULT 0,
  `min_experience` varchar(80) DEFAULT NULL,
  `description` text NOT NULL,
  `requirements` text NOT NULL,
  `opened_at` date NOT NULL,
  `closed_at` date NOT NULL,
  `status` enum('open','closed','draft') NOT NULL DEFAULT 'open',
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `recruitments`
--

INSERT INTO `recruitments` (`id`, `slug`, `company_id`, `category_id`, `employment_type_id`, `province_id`, `title`, `detail_address`, `salary_min`, `salary_max`, `hide_salary`, `min_experience`, `description`, `requirements`, `opened_at`, `closed_at`, `status`, `created_by`, `created_at`, `updated_at`) VALUES
(2, 'frontend-developer-f40f2841', 2, 9, 1, 11, 'Frontend Developer', 'blok m', NULL, NULL, 1, 'Minimal 2 Tahun', 'Buat website', 'Bisa ngoding', '2026-11-27', '2026-12-27', 'open', 6, '2026-11-27 07:14:13', '2026-11-27 07:21:28');

-- --------------------------------------------------------

--
-- Table structure for table `recruitment_benefits`
--

CREATE TABLE `recruitment_benefits` (
  `recruitment_id` int(11) NOT NULL,
  `benefit_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `recruitment_benefits`
--

INSERT INTO `recruitment_benefits` (`recruitment_id`, `benefit_id`) VALUES
(2, 2),
(2, 3),
(2, 5);

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `name` varchar(120) NOT NULL,
  `email` varchar(160) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('candidate','company','admin','super_admin') NOT NULL DEFAULT 'candidate',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'Super Admin', 'superadmin@jalurtumbuh.id', '$2b$10$W3FTK9zkgQDzT7KwWDE8uubihNsMjH8tap5NTTok5/CLy7Nt14mEC', 'super_admin', 1, '2026-11-25 06:21:59', '2026-11-25 06:21:59'),
(2, 'Admin Jalurtumbuh', 'admin@jalurtumbuh.id', '$2b$10$l3uST8VQoA8Zrr.jKAJAxez7vL9iQCs8ZmyEaVuHbGcvSJu6JwnSG', 'admin', 1, '2026-11-25 06:21:59', '2026-11-25 06:21:59'),
(5, 'Kandidat', 'kandidat@gmail.com', '$2b$10$dGPk6kJwq68rQmECVDjNbelaxpuu4tPiGm9dpQJmuWaw0aOtAyQVO', 'candidate', 1, '2026-11-27 07:09:43', '2026-11-27 07:09:43'),
(6, 'Perusahaan', 'perusahaan@gmail.com', '$2b$10$/a0hGFzvSvvqeMrqRvt7cOv/d7LCw6OMW7aK9FOzCceX4IiiMTRqO', 'company', 1, '2026-11-27 07:11:18', '2026-11-27 07:11:18');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `applications`
--
ALTER TABLE `applications`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_recruitment_candidate` (`recruitment_id`,`candidate_id`),
  ADD KEY `fk_app_candidate` (`candidate_id`);

--
-- Indexes for table `benefits`
--
ALTER TABLE `benefits`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_benefit_name` (`name`);

--
-- Indexes for table `candidate_experiences`
--
ALTER TABLE `candidate_experiences`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_ce_user` (`user_id`);

--
-- Indexes for table `candidate_profiles`
--
ALTER TABLE `candidate_profiles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `user_id` (`user_id`),
  ADD KEY `fk_cp_province` (`province_id`);

--
-- Indexes for table `companies`
--
ALTER TABLE `companies`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_company_province` (`province_id`);

--
-- Indexes for table `company_members`
--
ALTER TABLE `company_members`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_user_company` (`user_id`,`company_id`),
  ADD KEY `fk_cm_company` (`company_id`);

--
-- Indexes for table `employment_types`
--
ALTER TABLE `employment_types`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `job_categories`
--
ALTER TABLE `job_categories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `provinces`
--
ALTER TABLE `provinces`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `recruitments`
--
ALTER TABLE `recruitments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `slug` (`slug`),
  ADD KEY `fk_rec_company` (`company_id`),
  ADD KEY `fk_rec_category` (`category_id`),
  ADD KEY `fk_rec_emp_type` (`employment_type_id`),
  ADD KEY `fk_rec_province` (`province_id`),
  ADD KEY `fk_rec_creator` (`created_by`);

--
-- Indexes for table `recruitment_benefits`
--
ALTER TABLE `recruitment_benefits`
  ADD PRIMARY KEY (`recruitment_id`,`benefit_id`),
  ADD KEY `fk_rb_benefit` (`benefit_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `applications`
--
ALTER TABLE `applications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `benefits`
--
ALTER TABLE `benefits`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `candidate_experiences`
--
ALTER TABLE `candidate_experiences`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `candidate_profiles`
--
ALTER TABLE `candidate_profiles`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `companies`
--
ALTER TABLE `companies`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `company_members`
--
ALTER TABLE `company_members`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `employment_types`
--
ALTER TABLE `employment_types`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `job_categories`
--
ALTER TABLE `job_categories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `provinces`
--
ALTER TABLE `provinces`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=39;

--
-- AUTO_INCREMENT for table `recruitments`
--
ALTER TABLE `recruitments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `applications`
--
ALTER TABLE `applications`
  ADD CONSTRAINT `fk_app_candidate` FOREIGN KEY (`candidate_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_app_recruitment` FOREIGN KEY (`recruitment_id`) REFERENCES `recruitments` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `candidate_experiences`
--
ALTER TABLE `candidate_experiences`
  ADD CONSTRAINT `fk_ce_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `candidate_profiles`
--
ALTER TABLE `candidate_profiles`
  ADD CONSTRAINT `fk_cp_province` FOREIGN KEY (`province_id`) REFERENCES `provinces` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_cp_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `companies`
--
ALTER TABLE `companies`
  ADD CONSTRAINT `fk_company_province` FOREIGN KEY (`province_id`) REFERENCES `provinces` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `company_members`
--
ALTER TABLE `company_members`
  ADD CONSTRAINT `fk_cm_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_cm_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `recruitments`
--
ALTER TABLE `recruitments`
  ADD CONSTRAINT `fk_rec_category` FOREIGN KEY (`category_id`) REFERENCES `job_categories` (`id`),
  ADD CONSTRAINT `fk_rec_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_rec_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_rec_emp_type` FOREIGN KEY (`employment_type_id`) REFERENCES `employment_types` (`id`),
  ADD CONSTRAINT `fk_rec_province` FOREIGN KEY (`province_id`) REFERENCES `provinces` (`id`);

--
-- Constraints for table `recruitment_benefits`
--
ALTER TABLE `recruitment_benefits`
  ADD CONSTRAINT `fk_rb_benefit` FOREIGN KEY (`benefit_id`) REFERENCES `benefits` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_rb_recruitment` FOREIGN KEY (`recruitment_id`) REFERENCES `recruitments` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
