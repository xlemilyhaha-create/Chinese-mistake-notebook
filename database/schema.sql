-- 语文错题助手数据库表结构

CREATE DATABASE IF NOT EXISTS yuwen_cuoti CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE yuwen_cuoti;

CREATE TABLE IF NOT EXISTS word_entries (
  id VARCHAR(36) PRIMARY KEY,
  type ENUM('WORD', 'POEM') NOT NULL,
  word VARCHAR(255) NOT NULL,
  pinyin VARCHAR(500),
  created_at BIGINT NOT NULL,
  
  -- JSON fields for complex data
  definition_data JSON,
  definition_match_data JSON,
  poem_data JSON,
  enabled_types JSON NOT NULL,
  
  -- Test status tracking
  test_status ENUM('NOT_TESTED', 'FAILED', 'PASSED') NOT NULL DEFAULT 'NOT_TESTED',
  is_multiple_attempts BOOLEAN NOT NULL DEFAULT FALSE,
  previous_test_status ENUM('NOT_TESTED', 'FAILED', 'PASSED'),
  
  -- Indexes
  INDEX idx_created_at (created_at),
  INDEX idx_test_status (test_status),
  INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

