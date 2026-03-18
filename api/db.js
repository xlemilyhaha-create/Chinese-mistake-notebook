import mysql from 'mysql2/promise';

// Note: mysql2 must be installed in your environment: npm install mysql2
const pool = process.env.DATABASE_URL ? mysql.createPool({
  uri: process.env.DATABASE_URL, 
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {
    rejectUnauthorized: false 
  }
}) : null;

export default pool;
