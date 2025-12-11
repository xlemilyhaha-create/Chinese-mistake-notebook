-- 语文错题助手数据库表结构
-- 注意：数据库名应该与 MYSQL_DATABASE 环境变量一致
-- 如果使用不同的数据库名，请手动修改下面的数据库名

-- 使用环境变量中的数据库名（如果通过 docker-entrypoint-initdb.d 执行，会自动使用 MYSQL_DATABASE）
-- 如果手动执行，请将下面的数据库名改为实际使用的数据库名
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

