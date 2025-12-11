#!/bin/bash

# 数据库初始化脚本
# 用于在容器启动后初始化数据库（如果 schema.sql 未自动执行）

set -e

echo "等待 MySQL 启动..."
sleep 10

DB_HOST=${DB_HOST:-mysql}
DB_USER=${DB_USER:-root}
DB_PASSWORD=${MYSQL_ROOT_PASSWORD:-rootpassword}
DB_NAME=${DB_NAME:-yuwen_cuoti}

echo "连接 MySQL: $DB_HOST"

# 检查数据库是否存在，如果不存在则创建
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" <<EOF
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE \`$DB_NAME\`;
SOURCE /docker-entrypoint-initdb.d/schema.sql;
EOF

echo "数据库初始化完成！"

