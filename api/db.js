import mysql from 'mysql2/promise';

// Note: mysql2 must be installed in your environment: npm install mysql2
let pool = null;
try {
  pool = process.env.DATABASE_URL ? mysql.createPool({
    uri: process.env.DATABASE_URL, 
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: {
      rejectUnauthorized: false 
    }
  }) : null;
} catch (error) {
  console.error('Failed to create database pool. Please check your DATABASE_URL:', error);
}

export async function initDb() {
  if (!pool) return;
  try {
    const connection = await pool.getConnection();
    try {
      await connection.query(`
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
        )
      `);
      await connection.query(`
        CREATE TABLE IF NOT EXISTS rate_limits (
          ip VARCHAR(45) NOT NULL,
          window_start BIGINT NOT NULL,
          request_count INT DEFAULT 1,
          PRIMARY KEY (ip)
        )
      `);
      await connection.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(36) PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          created_at BIGINT NOT NULL
        )
      `);
      await connection.query(`
        CREATE TABLE IF NOT EXISTS verification_codes (
          id VARCHAR(36) PRIMARY KEY,
          email VARCHAR(255) NOT NULL,
          code VARCHAR(10) NOT NULL,
          expires_at BIGINT NOT NULL,
          created_at BIGINT NOT NULL
        )
      `);
      console.log('Database tables initialized successfully.');
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Failed to initialize database tables:', error);
  }
}

// Call initDb asynchronously
initDb();

export default pool;
