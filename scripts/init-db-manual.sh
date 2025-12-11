#!/bin/bash

# 手动初始化数据库脚本
# 用于在数据库已存在但表不存在时，手动创建表结构

set -e

# 从环境变量读取配置，如果没有则使用默认值
DB_HOST=${DB_HOST:-localhost}
DB_USER=${DB_USER:-root}
DB_PASSWORD=${MYSQL_ROOT_PASSWORD:-rootpassword}
DB_NAME=${MYSQL_DATABASE:-yuwen_cuoti}

echo "=========================================="
echo "数据库初始化脚本"
echo "=========================================="
echo "数据库主机: $DB_HOST"
echo "数据库用户: $DB_USER"
echo "数据库名称: $DB_NAME"
echo "=========================================="

# 检查 MySQL 是否可连接
echo "检查 MySQL 连接..."
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" -e "SELECT 1;" > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "❌ 无法连接到 MySQL，请检查配置"
    exit 1
fi
echo "✅ MySQL 连接成功"

# 创建数据库（如果不存在）
echo "创建数据库 $DB_NAME（如果不存在）..."
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" <<EOF
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EOF
echo "✅ 数据库 $DB_NAME 已就绪"

# 检查表是否已存在
echo "检查表 word_entries 是否存在..."
TABLE_EXISTS=$(mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" -D "$DB_NAME" -e "SHOW TABLES LIKE 'word_entries';" 2>/dev/null | grep -c word_entries || true)

if [ "$TABLE_EXISTS" -gt 0 ]; then
    echo "⚠️  表 word_entries 已存在，跳过创建"
    echo "如果表结构不正确，请先删除表："
    echo "  mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD -D $DB_NAME -e \"DROP TABLE IF EXISTS word_entries;\""
else
    echo "创建表 word_entries..."
    mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" -D "$DB_NAME" <<EOF
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
EOF
    echo "✅ 表 word_entries 创建成功"
fi

echo "=========================================="
echo "数据库初始化完成！"
echo "=========================================="

