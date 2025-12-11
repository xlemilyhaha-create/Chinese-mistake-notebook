import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'production';

// 中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS 中间件
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// API 路由 - 使用动态导入以支持 ES 模块
app.all('/api/analyze', async (req, res) => {
  try {
    const { default: handler } = await import('./api/analyze.js');
    return handler(req, res);
  } catch (error) {
    console.error('Analyze API error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.all('/api/words', async (req, res) => {
  try {
    const { default: handler } = await import('./api/words.js');
    return handler(req, res);
  } catch (error) {
    console.error('Words API error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 提供静态文件（Docker 环境中始终提供已构建的静态文件）
app.use(express.static(join(__dirname, 'dist')));
  
// SPA 路由：所有非 API 请求返回 index.html
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    try {
      res.sendFile(join(__dirname, 'dist', 'index.html'));
    } catch (error) {
      console.error('Error serving index.html:', error);
      res.status(404).send('Not Found');
    }
  }
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
  console.log(`Environment: ${NODE_ENV}`);
  if (NODE_ENV === 'production') {
    console.log('Serving static files from:', join(__dirname, 'dist'));
  }
});

