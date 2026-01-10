import mysql from 'mysql2/promise';

// Note: mysql2 must be installed in your environment: npm install mysql2
const pool = mysql.createPool({
  uri: process.env.DATABASE_URL, 
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {
    rejectUnauthorized: false 
  }
});

export default pool;
