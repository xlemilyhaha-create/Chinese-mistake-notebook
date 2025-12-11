#!/usr/bin/env node

/**
 * 数据库自动初始化脚本
 * 在应用启动时自动检查并创建/更新数据库表结构
 */

import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 从环境变量读取配置
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || process.env.MYSQL_ROOT_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || process.env.MYSQL_DATABASE || 'yuwen_cuoti';
const DB_PORT = parseInt(process.env.DB_PORT || process.env.MYSQL_PORT || '3306', 10);

// 表结构版本（每次修改表结构时递增此版本号）
const SCHEMA_VERSION = 1;

async function initDatabase() {
  let connection;
  
  try {
    console.log('========================================');
    console.log('数据库自动初始化');
    console.log('========================================');
    console.log(`数据库主机: ${DB_HOST}:${DB_PORT}`);
    console.log(`数据库用户: ${DB_USER}`);
    console.log(`数据库名称: ${DB_NAME}`);
    console.log('========================================');

    // 连接到 MySQL（不指定数据库）
    connection = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      multipleStatements: true
    });

    console.log('✅ MySQL 连接成功');

    // 创建数据库（如果不存在）
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`✅ 数据库 ${DB_NAME} 已就绪`);

    // 切换到目标数据库
    await connection.query(`USE \`${DB_NAME}\``);

    // 检查表是否存在
    const [tables] = await connection.query(
      `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'word_entries'`,
      [DB_NAME]
    );

    const tableExists = tables[0].count > 0;

    if (tableExists) {
      console.log('✅ 表 word_entries 已存在');

      // 检查表结构版本（如果存在 schema_version 表）
      const [versionTables] = await connection.query(
        `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'schema_version'`,
        [DB_NAME]
      );

      if (versionTables[0].count > 0) {
        const [versions] = await connection.query('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1');
        const currentVersion = versions[0]?.version || 0;
        
        if (currentVersion >= SCHEMA_VERSION) {
          console.log(`✅ 数据库结构已是最新版本 (v${currentVersion})`);
          return;
        } else {
          console.log(`⚠️  数据库结构版本为 v${currentVersion}，需要升级到 v${SCHEMA_VERSION}`);
          // 这里可以添加迁移逻辑
          console.log('⚠️  请手动执行迁移脚本或更新表结构');
        }
      } else {
        // 创建 schema_version 表用于版本管理
        await connection.query(`
          CREATE TABLE IF NOT EXISTS schema_version (
            version INT PRIMARY KEY,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        
        // 检查版本是否已存在，如果不存在则插入
        const [existingVersions] = await connection.query(
          'SELECT version FROM schema_version WHERE version = ?',
          [SCHEMA_VERSION]
        );
        
        if (existingVersions.length === 0) {
          await connection.query('INSERT INTO schema_version (version) VALUES (?)', [SCHEMA_VERSION]);
          console.log(`✅ 已记录数据库结构版本 v${SCHEMA_VERSION}`);
        } else {
          console.log(`✅ 数据库结构版本 v${SCHEMA_VERSION} 已存在`);
        }
      }
    } else {
      console.log('📝 表 word_entries 不存在，开始创建...');

      // 读取并执行 schema.sql
      const schemaPath = join(__dirname, '../database/schema.sql');
      let schemaSQL = readFileSync(schemaPath, 'utf-8');

      // 替换数据库名（如果 schema.sql 中使用的是固定数据库名）
      schemaSQL = schemaSQL.replace(/USE\s+yuwen_cuoti\s*;/i, `USE \`${DB_NAME}\`;`);
      schemaSQL = schemaSQL.replace(/CREATE DATABASE IF NOT EXISTS\s+yuwen_cuoti/i, 
        `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);

      // 执行 SQL（分割多个语句）
      const statements = schemaSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        if (statement.toLowerCase().includes('create database')) {
          // 跳过 CREATE DATABASE，因为已经创建了
          continue;
        }
        if (statement.toLowerCase().includes('use ')) {
          // 跳过 USE，因为已经切换了
          continue;
        }
        if (statement.length > 0) {
          await connection.query(statement);
        }
      }

      console.log('✅ 表 word_entries 创建成功');

      // 创建 schema_version 表并记录版本
      await connection.query(`
        CREATE TABLE IF NOT EXISTS schema_version (
          version INT PRIMARY KEY,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      
      // 检查版本是否已存在，如果不存在则插入
      const [existingVersions2] = await connection.query(
        'SELECT version FROM schema_version WHERE version = ?',
        [SCHEMA_VERSION]
      );
      
      if (existingVersions2.length === 0) {
        await connection.query('INSERT INTO schema_version (version) VALUES (?)', [SCHEMA_VERSION]);
        console.log(`✅ 已记录数据库结构版本 v${SCHEMA_VERSION}`);
      } else {
        console.log(`✅ 数据库结构版本 v${SCHEMA_VERSION} 已存在`);
      }
    }

    console.log('========================================');
    console.log('✅ 数据库初始化完成！');
    console.log('========================================');

  } catch (error) {
    console.error('❌ 数据库初始化失败:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 如果直接运行此脚本（通过 node scripts/init-db.js）
// 检查是否是主模块
const isMainModule = process.argv[1]?.endsWith('init-db.js') || 
                     import.meta.url.endsWith('init-db.js');
if (isMainModule) {
  initDatabase().catch(error => {
    console.error('初始化失败:', error);
    process.exit(1);
  });
}

export default initDatabase;

