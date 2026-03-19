
CREATE TABLE IF NOT EXISTS words (
  id VARCHAR(36) PRIMARY KEY,
  type VARCHAR(20) NOT NULL DEFAULT 'WORD',
  word VARCHAR(255) NOT NULL,
  pinyin VARCHAR(255),
  created_at BIGINT NOT NULL,
  definition_data JSON,
  definition_match_data JSON,
  poem_data JSON,
  enabled_types JSON,
  test_status VARCHAR(20) DEFAULT 'UNTESTED',
  passed_after_retries BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS rate_limits (
  ip VARCHAR(45) NOT NULL,
  window_start BIGINT NOT NULL,
  request_count INT DEFAULT 1,
  PRIMARY KEY (ip)
);

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS verification_codes (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  code VARCHAR(10) NOT NULL,
  expires_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL
);
