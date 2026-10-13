-- 오늘의 발견 v1.0 · MySQL 8.4 DDL, UTF8MB4
-- IDs are application-issued ULIDs (CHAR(26)); dates/times with suffix _utc are UTC DATETIME(3).
-- KST (Asia/Seoul) conversion must happen at API boundaries. Never fabricate booking/session data.
-- This is a migration baseline for Codex. Check real migration execution against MySQL 8.4 before production.
CREATE DATABASE IF NOT EXISTS discovery_today CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE discovery_today;

CREATE TABLE regions (
  region_code VARCHAR(12) NOT NULL PRIMARY KEY,
  name_ko VARCHAR(80) NOT NULL,
  parent_region_code VARCHAR(12) NULL,
  lat DECIMAL(10,7) NULL,
  lng DECIMAL(10,7) NULL,
  CONSTRAINT fk_regions_parent FOREIGN KEY (parent_region_code) REFERENCES regions(region_code),
  CONSTRAINT chk_region_lat CHECK (lat IS NULL OR lat BETWEEN -90 AND 90),
  CONSTRAINT chk_region_lng CHECK (lng IS NULL OR lng BETWEEN -180 AND 180)
);

CREATE TABLE data_sources (
  id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  source_code VARCHAR(70) NOT NULL UNIQUE,
  name_ko VARCHAR(120) NOT NULL,
  source_type ENUM('GOV_API','OFFICIAL_PAGE','PARTNER','USER_SUBMITTED') NOT NULL,
  base_url VARCHAR(2048) NULL,
  license_code VARCHAR(100) NULL,
  attribution_text VARCHAR(500) NULL,
  access_approval ENUM('PENDING','APPROVED','REJECTED','NOT_REQUIRED') NOT NULL DEFAULT 'PENDING',
  media_licensed BOOLEAN NOT NULL DEFAULT FALSE,
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at_utc DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);

CREATE TABLE source_sync_runs (
  id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  source_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  sync_type ENUM('FULL','INCREMENTAL','MANUAL','DRY_RUN') NOT NULL,
  state ENUM('STARTED','SUCCESS','PARTIAL','FAILED') NOT NULL DEFAULT 'STARTED',
  started_at_utc DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  finished_at_utc DATETIME(3) NULL,
  fetched_count INT UNSIGNED NOT NULL DEFAULT 0,
  accepted_count INT UNSIGNED NOT NULL DEFAULT 0,
  rejected_count INT UNSIGNED NOT NULL DEFAULT 0,
  error_code VARCHAR(100) NULL,
  error_summary TEXT NULL,
  CONSTRAINT fk_sync_source FOREIGN KEY (source_id) REFERENCES data_sources(id),
  KEY idx_sync_source_date (source_id, started_at_utc)
);

CREATE TABLE source_records (
  id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  source_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  source_item_key VARCHAR(300) NOT NULL,
  upstream_url VARCHAR(2048) NULL,
  payload_json JSON NOT NULL,
  payload_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  first_seen_utc DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_seen_utc DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_changed_utc DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_sync_run_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NULL,
  is_tombstoned BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT fk_sr_source FOREIGN KEY (source_id) REFERENCES data_sources(id),
  CONSTRAINT fk_sr_run FOREIGN KEY (last_sync_run_id) REFERENCES source_sync_runs(id),
  UNIQUE KEY uq_sr_source_key (source_id, source_item_key),
  KEY idx_sr_last_seen (last_seen_utc)
);

CREATE TABLE places (
  id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  name_ko VARCHAR(200) NULL,
  region_code VARCHAR(12) NULL,
  address_text VARCHAR(500) NULL,
  lat DECIMAL(10,7) NULL,
  lng DECIMAL(10,7) NULL,
  geocode_status ENUM('NOT_PROVIDED','FROM_SOURCE','VERIFIED','CONFLICT') NOT NULL DEFAULT 'NOT_PROVIDED',
  CONSTRAINT fk_places_region FOREIGN KEY (region_code) REFERENCES regions(region_code),
  CONSTRAINT chk_place_lat CHECK (lat IS NULL OR lat BETWEEN -90 AND 90),
  CONSTRAINT chk_place_lng CHECK (lng IS NULL OR lng BETWEEN -180 AND 180),
  KEY idx_places_region (region_code),
  KEY idx_places_geo (lat, lng)
);

CREATE TABLE activities (
  id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  title VARCHAR(350) NOT NULL,
  summary TEXT NULL,
  activity_type ENUM('FESTIVAL','PERFORMANCE','EXHIBITION','CLASS','SPORTS','FACILITY','OTHER') NOT NULL DEFAULT 'OTHER',
  lifecycle ENUM('DRAFT','PUBLISHED','PARTIAL','STALE','CONFLICT','BLOCKED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  price_kind ENUM('FREE','PAID','MIXED','UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
  price_note VARCHAR(500) NULL,
  region_code VARCHAR(12) NULL,
  place_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NULL,
  event_start_on DATE NULL,
  event_end_on DATE NULL,
  official_detail_url VARCHAR(2048) NULL,
  booking_status ENUM('OPEN','CLOSED','WAITLIST','NOT_REQUIRED','UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
  booking_status_checked_utc DATETIME(3) NULL,
  verification_level ENUM('OFFICIAL_API','OFFICIAL_PAGE','PARTNER_VERIFIED','USER_SUBMITTED_UNVERIFIED') NOT NULL DEFAULT 'USER_SUBMITTED_UNVERIFIED',
  last_verified_utc DATETIME(3) NULL,
  published_at_utc DATETIME(3) NULL,
  created_at_utc DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at_utc DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_act_region FOREIGN KEY (region_code) REFERENCES regions(region_code),
  CONSTRAINT fk_act_place FOREIGN KEY (place_id) REFERENCES places(id),
  CONSTRAINT chk_act_dates CHECK (event_start_on IS NULL OR event_end_on IS NULL OR event_end_on >= event_start_on),
  KEY idx_activities_discovery (lifecycle, region_code, event_start_on, event_end_on),
  KEY idx_activities_type (activity_type, lifecycle),
  FULLTEXT KEY idx_act_search (title, summary)
);

CREATE TABLE activity_source_links (
  activity_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  source_record_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  match_decision ENUM('CONFIRMED','PENDING','REJECTED') NOT NULL DEFAULT 'PENDING',
  reviewed_by_user_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NULL,
  reviewed_at_utc DATETIME(3) NULL,
  PRIMARY KEY (activity_id,source_record_id),
  CONSTRAINT fk_asl_act FOREIGN KEY (activity_id) REFERENCES activities(id),
  CONSTRAINT fk_asl_source FOREIGN KEY (source_record_id) REFERENCES source_records(id)
);

CREATE TABLE activity_programs (
  id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  activity_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  name VARCHAR(300) NOT NULL,
  description TEXT NULL,
  price_kind ENUM('FREE','PAID','MIXED','UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
  min_price_krw INT UNSIGNED NULL,
  max_price_krw INT UNSIGNED NULL,
  price_note VARCHAR(500) NULL,
  participation_note TEXT NULL,
  CONSTRAINT fk_program_act FOREIGN KEY (activity_id) REFERENCES activities(id),
  CONSTRAINT chk_program_prices CHECK (min_price_krw IS NULL OR max_price_krw IS NULL OR max_price_krw >= min_price_krw),
  KEY idx_program_act (activity_id)
);

CREATE TABLE activity_sessions (
  id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  program_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  starts_at_utc DATETIME(3) NULL,
  ends_at_utc DATETIME(3) NULL,
  place_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NULL,
  booking_status ENUM('OPEN','CLOSED','WAITLIST','NOT_REQUIRED','UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
  booking_url VARCHAR(2048) NULL,
  booking_open_at_utc DATETIME(3) NULL,
  booking_close_at_utc DATETIME(3) NULL,
  booking_checked_utc DATETIME(3) NULL,
  price_krw INT UNSIGNED NULL,
  seats_available INT UNSIGNED NULL,
  seats_checked_utc DATETIME(3) NULL,
  source_record_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NULL,
  CONSTRAINT fk_session_program FOREIGN KEY (program_id) REFERENCES activity_programs(id),
  CONSTRAINT fk_session_place FOREIGN KEY (place_id) REFERENCES places(id),
  CONSTRAINT fk_session_record FOREIGN KEY (source_record_id) REFERENCES source_records(id),
  CONSTRAINT chk_session_datetime CHECK (starts_at_utc IS NULL OR ends_at_utc IS NULL OR ends_at_utc >= starts_at_utc),
  KEY idx_session_start (starts_at_utc, booking_status),
  KEY idx_session_program (program_id)
);

CREATE TABLE media_assets (
  id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  source_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NULL,
  storage_key VARCHAR(350) NULL,
  remote_url VARCHAR(2048) NULL,
  alt_text VARCHAR(350) NOT NULL,
  license_code VARCHAR(120) NULL,
  attribution_text VARCHAR(400) NULL,
  rights_verified_at_utc DATETIME(3) NULL,
  public_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT fk_media_source FOREIGN KEY (source_id) REFERENCES data_sources(id),
  KEY idx_media_rights (public_allowed, rights_verified_at_utc)
);

CREATE TABLE activity_media (
  activity_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  media_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  position INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (activity_id,media_id),
  CONSTRAINT fk_am_activity FOREIGN KEY (activity_id) REFERENCES activities(id),
  CONSTRAINT fk_am_media FOREIGN KEY (media_id) REFERENCES media_assets(id)
);

CREATE TABLE users (
  id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  display_name VARCHAR(80) NULL,
  email VARCHAR(254) NULL,
  role ENUM('USER','CURATOR','ADMIN') NOT NULL DEFAULT 'USER',
  created_at_utc DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  deleted_at_utc DATETIME(3) NULL,
  UNIQUE KEY uq_user_email (email)
);

CREATE TABLE user_identities (
  id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  user_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  provider ENUM('GOOGLE','KAKAO','NAVER','APPLE') NOT NULL,
  provider_subject VARCHAR(255) NOT NULL,
  created_at_utc DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_identity_provider_subject (provider, provider_subject),
  CONSTRAINT fk_identity_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE user_preferences (
  user_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  region_code VARCHAR(12) NULL,
  preferred_categories_json JSON NULL,
  max_budget_krw INT UNSIGNED NULL,
  email_marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  notifications_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at_utc DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_pref_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_pref_region FOREIGN KEY (region_code) REFERENCES regions(region_code)
);

CREATE TABLE user_favorites (
  user_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  activity_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at_utc DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, activity_id),
  CONSTRAINT fk_fav_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_fav_act FOREIGN KEY (activity_id) REFERENCES activities(id)
);

CREATE TABLE user_experiences (
  id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  user_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  activity_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NULL,
  experienced_on DATE NOT NULL,
  title VARCHAR(250) NULL,
  memo TEXT NULL,
  proof_level ENUM('SELF_REPORTED','ORGANIZER_CONFIRMED') NOT NULL DEFAULT 'SELF_REPORTED',
  visibility ENUM('PRIVATE','LINK_ONLY','PUBLIC') NOT NULL DEFAULT 'PRIVATE',
  created_at_utc DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  deleted_at_utc DATETIME(3) NULL,
  CONSTRAINT fk_exp_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_exp_activity FOREIGN KEY (activity_id) REFERENCES activities(id),
  KEY idx_exp_user_date (user_id, experienced_on)
);

CREATE TABLE missions (
  id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  rule_json JSON NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT chk_mission_window CHECK (ends_on >= starts_on)
);

CREATE TABLE user_mission_progress (
  user_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  mission_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  progress_value INT UNSIGNED NOT NULL DEFAULT 0,
  completed_at_utc DATETIME(3) NULL,
  evaluated_at_utc DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, mission_id),
  CONSTRAINT fk_ump_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_ump_mission FOREIGN KEY (mission_id) REFERENCES missions(id)
);

CREATE TABLE notification_rules (
  id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  user_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  kind ENUM('NEW_ACTIVITY','REGISTRATION_OPEN','DATE_CHANGED') NOT NULL,
  region_code VARCHAR(12) NULL,
  filter_json JSON NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at_utc DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_nr_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_nr_region FOREIGN KEY (region_code) REFERENCES regions(region_code)
);

CREATE TABLE notifications (
  id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  user_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  dedupe_key VARCHAR(255) NOT NULL,
  kind VARCHAR(50) NOT NULL,
  payload_json JSON NOT NULL,
  state ENUM('PENDING','SENT','FAILED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  created_at_utc DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  sent_at_utc DATETIME(3) NULL,
  CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY uq_notif_dedupe (user_id, dedupe_key),
  KEY idx_notif_queue (state, created_at_utc)
);

CREATE TABLE merge_review_cases (
  id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  left_source_record_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  right_source_record_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  reason VARCHAR(500) NOT NULL,
  decision ENUM('OPEN','SAME_EVENT','DIFFERENT_EVENT') NOT NULL DEFAULT 'OPEN',
  reviewed_at_utc DATETIME(3) NULL,
  CONSTRAINT fk_merge_left FOREIGN KEY (left_source_record_id) REFERENCES source_records(id),
  CONSTRAINT fk_merge_right FOREIGN KEY (right_source_record_id) REFERENCES source_records(id),
  UNIQUE KEY uq_merge_pair (left_source_record_id,right_source_record_id)
);

CREATE TABLE content_reports (
  id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  activity_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NULL,
  reporter_user_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NULL,
  reason ENUM('WRONG_DATE','WRONG_PRICE','BROKEN_LINK','COPYRIGHT','OTHER') NOT NULL,
  details TEXT NULL,
  state ENUM('OPEN','INVESTIGATING','RESOLVED','DISMISSED') NOT NULL DEFAULT 'OPEN',
  created_at_utc DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_report_act FOREIGN KEY (activity_id) REFERENCES activities(id),
  CONSTRAINT fk_report_user FOREIGN KEY (reporter_user_id) REFERENCES users(id)
);

CREATE TABLE audit_logs (
  id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  actor_user_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NULL,
  actor_type ENUM('USER','SYSTEM') NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(70) NOT NULL,
  entity_id VARCHAR(70) NOT NULL,
  detail_json JSON NULL,
  created_at_utc DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users(id),
  KEY idx_audit_entity_time (entity_type,entity_id,created_at_utc)
);
