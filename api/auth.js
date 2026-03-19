import express from 'express';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import pool from './db.js';

const router = express.Router();

// Setup nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.qq.com',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// 1. Send Verification Code
router.post('/send-code', async (req, res) => {
  const { email } = req.body;
  
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: '无效的邮箱地址' });
  }

  if (!pool) {
    return res.status(503).json({ error: '数据库未配置' });
  }

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return res.status(503).json({ error: '邮件服务未配置 (SMTP_USER / SMTP_PASS)' });
  }

  try {
    const connection = await pool.getConnection();
    
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    const id = crypto.randomUUID();

    try {
      // Save code to DB
      await connection.query(
        `INSERT INTO verification_codes (id, email, code, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`,
        [id, email, code, expiresAt, Date.now()]
      );

      // Send email
      await transporter.sendMail({
        from: `"语文错题助手" <${process.env.SMTP_USER}>`,
        to: email,
        subject: '您的登录验证码',
        text: `您的登录验证码是：${code}。该验证码在 10 分钟内有效。请勿泄露给他人。`,
        html: `<p>您的登录验证码是：<strong style="font-size: 24px;">${code}</strong></p><p>该验证码在 10 分钟内有效。请勿泄露给他人。</p>`
      });

      res.json({ success: true, message: '验证码已发送' });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Send code error:', error);
    res.status(500).json({ error: '发送验证码失败，请稍后再试' });
  }
});

// 2. Verify Code and Login
router.post('/verify-code', async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: '邮箱和验证码不能为空' });
  }

  if (!pool) {
    return res.status(503).json({ error: '数据库未配置' });
  }

  try {
    const connection = await pool.getConnection();
    
    try {
      // Check code
      const [rows] = await connection.query(
        `SELECT * FROM verification_codes WHERE email = ? AND code = ? AND expires_at > ? ORDER BY created_at DESC LIMIT 1`,
        [email, code, Date.now()]
      );

      if (rows.length === 0) {
        return res.status(400).json({ error: '验证码错误或已过期' });
      }

      // Mark code as used (delete it)
      await connection.query(`DELETE FROM verification_codes WHERE id = ?`, [rows[0].id]);

      // Find or create user
      let [users] = await connection.query(`SELECT * FROM users WHERE email = ?`, [email]);
      let user = users[0];

      if (!user) {
        const userId = crypto.randomUUID();
        await connection.query(
          `INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)`,
          [userId, email, Date.now()]
        );
        user = { id: userId, email };
      }

      // Generate JWT (valid for 365 days for long-term login)
      const jwtSecret = process.env.JWT_SECRET || 'default_jwt_secret_for_dev_only';
      const token = jwt.sign(
        { id: user.id, email: user.email },
        jwtSecret,
        { expiresIn: '365d' }
      );

      res.json({
        success: true,
        token,
        user: { id: user.id, email: user.email }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Verify code error:', error);
    res.status(500).json({ error: '验证失败，请稍后再试' });
  }
});

export default router;
